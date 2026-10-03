import { handleStart } from './handlers/start.ts';
import { handlePayment } from './handlers/payment.ts';
import { handleVerify } from './handlers/verify.ts';
import { handleSupport } from './handlers/support.ts';
import { supabase } from './services/supabase.ts';
import { sendMessage } from './services/telegram.ts';
import type { TelegramUpdate } from './types/index.ts';

const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
if (!WEBHOOK_SECRET) {
  // Fail closed. Without the secret anyone who learns the webhook URL can POST
  // forged updates, and every handler trusts the payload (e.g. /start rebinds
  // an order to the caller's chat id).
  throw new Error(
    'TELEGRAM_WEBHOOK_SECRET is not set — refusing to start with an unauthenticated webhook',
  );
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Compare two secrets without an early-exit that leaks the matching prefix.
 * Both values are fixed-length webhook secrets, so the length check is safe.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

/**
 * Record an update_id. Returns false when it has already been handled.
 *
 * Telegram redelivers an update until it gets a 2xx and the handlers are not
 * idempotent, so an already-seen update_id is acknowledged without dispatch.
 */
async function markUpdateSeen(updateId: number): Promise<boolean> {
  const { error } = await supabase
    .from('telegram_updates')
    .insert({ update_id: updateId });

  if (!error) return true;
  if (error.code === '23505') return false; // unique violation: already handled

  // Fail open rather than drop the user's message; the duplicate window is only
  // as wide as Telegram's retry loop.
  console.error('Could not record update_id:', error.message);
  return true;
}

Deno.serve(async (req) => {
  // Telegram echoes the secret configured via setWebhook. Check it before the
  // body is parsed so a forged update never reaches a handler.
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  if (!secret || !timingSafeEqual(secret, WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  let recorded = false;
  try {
    recorded = await markUpdateSeen(update.update_id);
    if (!recorded) {
      // Duplicate delivery — acknowledge so Telegram stops retrying.
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: JSON_HEADERS,
      });
    }

    const text = update.message?.text;
    if (text) {
      // Compare the first token, not a string prefix: "/starter" used to match
      // /start, and a group message ("/start@TrivaroPayBot payload") yielded
      // "@TrivaroPayBot" as the payload from split(' ')[1].
      const [firstToken = '', ...rest] = text.trim().split(/\s+/);
      const command = firstToken.replace(/@\w+$/, '').toLowerCase();
      const payload = rest[0] ?? '';

      const chatId = update.message!.chat.id;
      const username = update.message!.from?.username;

      if (command === '/start') {
        await handleStart(chatId, payload, username);
      } else if (command === '/pay') {
        await handlePayment(chatId, text);
      } else if (command === '/verify') {
        await handleVerify(chatId, text);
      } else if (command === '/help' || command === '/support') {
        // /support is advertised by handleSupport(); without this branch it
        // fell through to the generic reply.
        await handleSupport(chatId);
      } else {
        await sendMessage(chatId, 'Use /start to begin or /help for assistance.');
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
  } catch (error) {
    console.error('Bot error:', error);
    // Returning 500 made Telegram redeliver the same failing update forever.
    // Record it durably (it is already recorded in the normal path; this covers
    // a failure inside markUpdateSeen itself) and acknowledge.
    if (!recorded) {
      try {
        await markUpdateSeen(update.update_id);
      } catch (recordError) {
        console.error('Failed to record failed update:', recordError);
      }
    }
    return new Response(JSON.stringify({ ok: false }), { headers: JSON_HEADERS });
  }
});
