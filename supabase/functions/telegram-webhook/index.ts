// ============================================================================
// telegram-webhook — handles updates pushed by Telegram.
//
// AUTHENTICATION
//   Telegram signs every delivery with the secret passed to `setWebhook` as
//   `secret_token`, which arrives in the `X-Telegram-Bot-Api-Secret-Token`
//   header. That header is verified here in constant time, and the function
//   fails CLOSED (500) when `TELEGRAM_WEBHOOK_SECRET` is unset — without this
//   check anyone who knows the URL can forge updates.
//
//   This function deliberately does NOT require `EDGE_FUNCTION_API_KEY`:
//   Telegram cannot be configured to send an `Authorization` header, so adding
//   that requirement would make the endpoint permanently unreachable. The
//   secret-token check is this endpoint's authentication.
//
// IDEMPOTENCY
//   Telegram redelivers an update until it gets a 2xx. Every `update_id` is
//   claimed in `public.telegram_updates` (migration 015) before any work, so a
//   redelivery is acknowledged and skipped. If processing throws, the claim is
//   released so the retry can still be handled.
//
// ENV VARS (Supabase -> Edge Functions -> Secrets):
//   TELEGRAM_WEBHOOK_SECRET   required  value given to setWebhook's
//                                       `secret_token`; fail-closed when unset
//   TELEGRAM_BOT_TOKEN        required  bot that sends the replies
//   SUPABASE_URL              required  platform-provided
//   SUPABASE_SECRET_KEYS     required  platform-provided JSON key map
//   HOT_WALLET_USDT_TRC20     fallback  payment address; app_config.hot_wallet_trc20
//                                       (the same key create_order and
//                                       verify-payment read) takes priority
// ============================================================================

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import {
  firstRow,
  getSupabaseSecretKey,
  json,
  OUTBOUND_TIMEOUT_MS,
  requireEnv,
  timingSafeEqual,
} from '../_shared/security.ts';

type SupabaseClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: any }>;
};

let cachedClient: SupabaseClient | null = null;

function db(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = requireEnv('SUPABASE_URL');
  const key = getSupabaseSecretKey();
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  }) as unknown as SupabaseClient;
  return cachedClient;
}

const PLACEHOLDER_PREFIX = 'REPLACE_ME';

/**
 * Deposit address for TRC20 invoices.
 *
 * Source of truth is `public.app_config` — the same key `create_order()` and
 * `verify-payment` read. Reading only the env var meant a Telegram invoice
 * could print an address the verifier never scans: funds arrive, no order
 * credits, nothing logged. The env var remains a fallback for projects that
 * have not populated app_config yet.
 */
async function resolveHotWallet(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'hot_wallet_trc20')
      .maybeSingle();
    const value = typeof data?.value === 'string' ? data.value.trim() : '';
    if (value && !value.startsWith(PLACEHOLDER_PREFIX)) return value;
  } catch (error) {
    console.error(
      'app_config lookup failed:',
      error instanceof Error ? error.message : 'unknown',
    );
  }
  return requireEnv('HOT_WALLET_USDT_TRC20');
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; username?: string; type?: string };
    text?: string;
    from?: { id: number; username?: string };
  };
}

interface OrderRow {
  id: string;
  payment_id: string;
  status: string;
  network: string | null;
  crypto_currency: string | null;
  telegram_user_id: number | null;
  amount_usd: string | number;
  crypto_amount: string | number | null;
  account_size: number;
}

/** Payload minted by /api/telegram/link: `link_` + 48 lowercase hex chars. */
const LINK_PAYLOAD_RE = /^link_([0-9a-f]{48})$/;

const SECRET_TOKEN_HEADER = 'x-telegram-bot-api-secret-token';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Reply to a chat. Failures are logged, never thrown: a dropped reply must
 *  not make Telegram redeliver an update we have already processed. */
async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  parseMode?: string,
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (parseMode) body.parse_mode = parseMode;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({})) as { description?: unknown };
      console.error(
        `telegram sendMessage failed (${res.status}):`,
        String(detail?.description ?? '').slice(0, 120),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('telegram sendMessage error:', error instanceof Error ? error.name : 'unknown');
    return false;
  }
}

/**
 * SHA-256 hex — must match `hashToken()` in apps/web/src/app/api/telegram/link.
 * Only the digest is stored, so a leaked `telegram_link_tokens` row is not a
 * usable invitation.
 */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Redeem a dashboard-issued link token.
 *
 * The Telegram user id comes from `message.from.id` (falling back to the chat
 * id, which is the same number in a private chat) — never from the text the
 * customer typed and never from a username, which is optional and mutable.
 * Binding is done by the `redeem_telegram_link` RPC so two concurrent
 * deliveries of one token cannot both win.
 */
async function handleLink(
  supabase: SupabaseClient,
  botToken: string,
  chatId: number,
  telegramUserId: number,
  token: string,
  username?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('redeem_telegram_link', {
    p_token_hash: await sha256Hex(token),
    p_telegram_id: telegramUserId,
    p_telegram_username: username ?? null,
  });

  if (error) {
    console.error('redeem_telegram_link failed:', error.code ?? 'unknown');
    await sendMessage(botToken, chatId, '⚠️ Something went wrong. Please try again shortly.');
    return;
  }

  const result = typeof data === 'string' ? data : '';
  if (result === 'ok') {
    const who = username ? ` (@${escapeHtml(username)})` : '';
    await sendMessage(
      botToken,
      chatId,
      [
        '✅ <b>Telegram connected</b>',
        '',
        `This chat${who} is now linked to your Trivaro account.`,
        'You can close this and return to your dashboard.',
      ].join('\n'),
      'HTML',
    );
    return;
  }

  if (result === 'taken') {
    // Deliberately does not name the other account: the caller may not own it.
    await sendMessage(
      botToken,
      chatId,
      '❌ This Telegram account is already connected to a different Trivaro account. Sign in to that account to disconnect it, or contact support.',
    );
    return;
  }

  await sendMessage(
    botToken,
    chatId,
    '❌ This link is invalid or has expired. Open your dashboard and press “Connect Telegram” to get a fresh one.',
  );
}

async function handleStart(
  supabase: SupabaseClient,
  botToken: string,
  chatId: number,
  payload: string,
  username?: string,
): Promise<void> {
  const match = /^order_([A-Za-z0-9_-]{1,128})$/.exec(payload.trim());
  if (!match) {
    await sendMessage(botToken, chatId, '❌ Please start from the website to create an order.');
    return;
  }
  const paymentId = match[1];

  const { data: orderRows, error: orderError } = await supabase
    .from('orders')
    .select('id,payment_id,status,network,telegram_user_id,amount_usd,crypto_amount,account_size')
    .eq('payment_id', paymentId);

  if (orderError) {
    console.error('orders lookup failed:', orderError.code);
    await sendMessage(botToken, chatId, '⚠️ Something went wrong. Please try again shortly.');
    return;
  }

  const order = firstRow<OrderRow>(orderRows);
  if (!order) {
    await sendMessage(botToken, chatId, '❌ Order not found. Please start from the website.');
    return;
  }

  // An order may only ever be bound to the first chat that claims it (or to
  // the chat it is already bound to). Without this, anyone who learns a
  // payment id could rebind the order and receive the victim's credentials.
  if (order.telegram_user_id !== null && Number(order.telegram_user_id) !== chatId) {
    console.error(`order ${order.id} is already bound to another chat`);
    await sendMessage(botToken, chatId, '❌ This order is already linked to another Telegram account.');
    return;
  }

  if (order.status !== 'pending') {
    await sendMessage(botToken, chatId, '❌ This order has already been processed.');
    return;
  }

  // The bot only knows how to invoice USDT on Tron: its amount offset is in
  // cents and its deposit address is the TRC20 wallet. A USDC or BTC order no
  // longer looks unpaid from here — it is handed back to the website, which
  // shows the rail it was actually quoted in.
  if ((order.network ?? 'TRC20').toUpperCase() !== 'TRC20') {
    await sendMessage(
      botToken,
      chatId,
      `❌ This order is quoted in ${escapeHtml(order.crypto_currency ?? 'another asset')} and must be completed on the website — the Telegram bot only invoices USDT on Tron.`,
    );
    return;
  }

  const hotWallet = await resolveHotWallet(supabase);
  if (!hotWallet) {
    console.error('hot_wallet_trc20 / HOT_WALLET_USDT_TRC20 is not set — cannot issue an invoice');
    await sendMessage(botToken, chatId, '⚠️ Payments are temporarily unavailable. Please try again shortly.');
    return;
  }

  // The amount offset is computed ONCE per order. Re-randomising it on every
  // /start stranded payments that were already in flight at the old amount.
  let cryptoAmount = order.crypto_amount === null || order.crypto_amount === undefined
    ? null
    : Number(order.crypto_amount);

  if (cryptoAmount === null || !Number.isFinite(cryptoAmount)) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff;
    const offset = 0.01 + random * 0.99;
    const proposed = Math.round((Number(order.amount_usd) + offset) * 100) / 100;

    const { error: amountError } = await supabase
      .from('orders')
      .update({ crypto_amount: proposed })
      .eq('id', order.id)
      .eq('status', 'pending')
      .is('crypto_amount', null);

    if (amountError) console.error('crypto_amount write failed:', amountError.code);

    // Re-read so the invoice always shows the value that won the race.
    const { data: freshRows, error: freshError } = await supabase
      .from('orders')
      .select('crypto_amount')
      .eq('id', order.id);

    if (freshError) console.error('crypto_amount re-read failed:', freshError.code);

    const fresh = firstRow<{ crypto_amount: string | number | null }>(freshRows);
    const stored = fresh?.crypto_amount;
    cryptoAmount = stored === null || stored === undefined
      ? proposed
      : Number(stored);
  }

  // Bind the chat atomically: the guard rejects a row that another chat bound
  // between the check above and this write.
  const { data: boundRows, error: bindError } = await supabase
    .from('orders')
    .update({
      telegram_user_id: chatId,
      telegram_username: username ?? null,
      // Kept for display/audit only — verify-payment reads its own env var and
      // never trusts this column.
      wallet_address: hotWallet,
    })
    .eq('id', order.id)
    .eq('status', 'pending')
    .or(`telegram_user_id.is.null,telegram_user_id.eq.${chatId}`)
    .select('id');

  const bound = firstRow<{ id: string }>(boundRows);

  if (bindError) {
    console.error('order binding failed:', bindError.code);
    await sendMessage(botToken, chatId, '⚠️ Something went wrong. Please try again shortly.');
    return;
  }
  if (!bound) {
    await sendMessage(botToken, chatId, '❌ This order is already linked to another Telegram account.');
    return;
  }

  const accountSizeLabel = `$${(Number(order.account_size) / 1000).toFixed(0)}K`;
  const amountLabel = cryptoAmount.toFixed(2);

  const message = [
    '🧾 <b>Payment Invoice</b>',
    '',
    `📋 Order: <code>${escapeHtml(paymentId)}</code>`,
    `📊 Account: ${escapeHtml(accountSizeLabel)}`,
    `💰 Amount: <code>${escapeHtml(amountLabel)} USDT (TRC20)</code>`,
    '',
    '📤 <b>Send to:</b>',
    `<code>${escapeHtml(hotWallet)}</code>`,
    '',
    '⏱ Expires: 30 minutes',
    '',
    `⚠️ Send <b>exactly</b> ${escapeHtml(amountLabel)} USDT on TRC20 network.`,
    'This invoice is USDT on Tron. Sending any other asset or network cannot be matched to this order — USDC (Ethereum) and Bitcoin are payable on the website.',
  ].join('\n');

  await sendMessage(botToken, chatId, message, 'HTML');
}

async function handleUpdate(supabase: SupabaseClient, botToken: string, update: TelegramUpdate) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text;
  const username = message.from?.username ?? message.chat.username;
  const telegramUserId = message.from?.id ?? chatId;

  if (text.startsWith('/start')) {
    const payload = (text.split(/\s+/)[1] ?? '').trim();
    const link = LINK_PAYLOAD_RE.exec(payload);

    // Account linking is only meaningful in a private chat: in a group the
    // redeemer would bind the group's id, and every reply would leak that
    // customer's invoices to the other members.
    if (link && message.chat.type && message.chat.type !== 'private') {
      await sendMessage(
        botToken,
        chatId,
        '❌ Open this link in a private chat with the bot to connect your account.',
      );
    } else if (link) {
      await handleLink(supabase, botToken, chatId, telegramUserId, link[1], username);
    } else {
      await handleStart(supabase, botToken, chatId, payload, username);
    }
  } else if (text === '/help') {
    await sendMessage(
      botToken,
      chatId,
      '🤖 Trivaro Bot\n\n/start - Start payment\n/help - Show this help\n/support - Contact support',
    );
  } else {
    await sendMessage(botToken, chatId, 'Use /start to begin payment or /help for assistance.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    // Not a browser endpoint; there is nothing to preflight.
    return new Response(null, { status: 204 });
  }

  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

    // Fail closed: without the secret we cannot tell Telegram from an attacker.
    const webhookSecret = requireEnv('TELEGRAM_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('FATAL: TELEGRAM_WEBHOOK_SECRET is not set — refusing all updates');
      return json({ ok: false, error: 'server_misconfigured' }, 500);
    }

    const presented = req.headers.get(SECRET_TOKEN_HEADER) ?? '';
    if (!(await timingSafeEqual(presented, webhookSecret))) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const botToken = requireEnv('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN is not set');
      return json({ ok: false, error: 'server_misconfigured' }, 500);
    }

    const supabase = db();
    if (!supabase) {
      console.error('SUPABASE_URL / SUPABASE_SECRET_KEYS not set');
      return json({ ok: false, error: 'server_misconfigured' }, 500);
    }

    const raw = await req.text();
    let update: TelegramUpdate;
    try {
      update = JSON.parse(raw) as TelegramUpdate;
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    if (!Number.isSafeInteger(update?.update_id)) {
      return json({ ok: false, error: 'invalid_update' }, 400);
    }

    // Claim the update before doing any work.
    const { error: claimError } = await supabase
      .from('telegram_updates')
      .insert({ update_id: update.update_id });

    if (claimError) {
      if (claimError.code === '23505') {
        // Already handled — acknowledge so Telegram stops redelivering.
        return json({ ok: true, duplicate: true }, 200);
      }
      console.error('update claim failed:', claimError.code);
      return json({ ok: false }, 500);
    }

    try {
      await handleUpdate(supabase, botToken, update);
    } catch (error) {
      // Release the claim so Telegram's retry is processed instead of skipped.
      const { error: releaseError } = await supabase
        .from('telegram_updates')
        .delete()
        .eq('update_id', update.update_id);
      if (releaseError) console.error('failed to release update claim:', releaseError.code);
      throw error;
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('webhook error:', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false }, 500);
  }
});
