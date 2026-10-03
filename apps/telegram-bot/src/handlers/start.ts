import { supabase } from '../services/supabase.ts';
import { sendMessage } from '../services/telegram.ts';
import { paymentMessage } from '../templates/paymentMessage.ts';

// USDT has 6 decimals on TRC20; see deterministicOffset().
const AMOUNT_DECIMALS = 6;
const AMOUNT_SCALE = 10 ** AMOUNT_DECIMALS;
const OFFSET_MIN = 0.01;
const OFFSET_MAX = 0.99;

function roundAmount(amount: number): number {
  return Math.round(amount * AMOUNT_SCALE) / AMOUNT_SCALE;
}

/**
 * Deterministic per-order payment offset.
 *
 * The amount used to be re-rolled with Math.random() on every /start —
 * including Telegram's own retries — so an in-flight payment sent at the
 * previously quoted amount no longer matched the amount verification expected
 * (|amount - expected| < 0.01) and the money became unverifiable.
 *
 * Sub-cent precision instead of whole cents: with cents, two concurrent buyers
 * of the same tier collided with probability ~1/99, and an incoming payment
 * cannot be attributed to an order when both quote the same amount.
 */
async function deterministicOffset(paymentId: string): Promise<number> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`trivaro-offset:${paymentId}`),
  );
  const fraction = new DataView(digest).getUint32(0) / 0xffffffff; // 0..1
  const offset = OFFSET_MIN + fraction * (OFFSET_MAX - OFFSET_MIN);
  return Math.round(offset * AMOUNT_SCALE) / AMOUNT_SCALE;
}

export async function handleStart(chatId: number, payload: string, username?: string) {
  const paymentId = payload.replace('order_', '');

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle();

  // maybeSingle + explicit error branch: the old `.single()` discarded the
  // error, so a transient DB failure was reported to the user as a bad order.
  if (error) {
    console.error('Order lookup failed:', error.message);
    await sendMessage(
      chatId,
      '⚠️ We could not load your order right now. Please try again in a moment or contact /support.',
    );
    return;
  }

  if (!order) {
    await sendMessage(chatId, '❌ Order not found. Please visit the website to create an order first.');
    return;
  }

  // Bind an order to a Telegram user exactly once. The payment id is rendered
  // on the marketing page and embedded in the ?start=order_<id> deep link, so
  // without this check anyone who saw it could rebind the order to themselves
  // and later receive the account credentials sent to telegram_user_id.
  const boundUserId = order.telegram_user_id === null || order.telegram_user_id === undefined
    ? null
    : Number(order.telegram_user_id);
  if (boundUserId !== null && boundUserId !== chatId) {
    console.warn(`Order ${paymentId} is already linked to another Telegram user`);
    await sendMessage(
      chatId,
      '❌ This order is already linked to a different Telegram account. If you believe this is a mistake, contact /support.',
    );
    return;
  }

  if (order.status !== 'pending') {
    await sendMessage(chatId, '❌ This order has already been processed.');
    return;
  }

  const walletAddress = Deno.env.get('HOT_WALLET_USDT_TRC20')?.trim();
  if (!walletAddress) {
    // The old `|| ''` fallback wrote an empty string to orders.wallet_address
    // and rendered an empty code span while the order still looked payable.
    console.error('HOT_WALLET_USDT_TRC20 is not configured — refusing to quote a payment');
    await sendMessage(
      chatId,
      '⚠️ Payments are temporarily unavailable. Please contact /support.',
    );
    return;
  }

  // Reuse the amount already quoted for this order. Re-deriving it on a repeat
  // /start would strand a payment the user has already sent at the old amount.
  const storedAmount = order.crypto_amount === null || order.crypto_amount === undefined
    ? null
    : Number(order.crypto_amount);
  const cryptoAmount = storedAmount ??
    roundAmount(Number(order.amount_usd) + await deterministicOffset(paymentId));

  // Keep a non-empty address already on the order (never overwrite it with ''),
  // and show the user the address that is actually persisted.
  const resolvedWallet = order.wallet_address?.trim() || walletAddress;

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      telegram_user_id: chatId,
      telegram_username: username ?? order.telegram_username,
      wallet_address: resolvedWallet,
      crypto_amount: cryptoAmount,
    })
    .eq('payment_id', paymentId);

  if (updateError) {
    console.error('Order update failed:', updateError.message);
    await sendMessage(
      chatId,
      '⚠️ We could not save your order right now. Please try again in a moment or contact /support.',
    );
    return;
  }

  const msg = paymentMessage({
    paymentId,
    accountSize: order.account_size,
    amount: cryptoAmount,
    currency: 'USDT',
    network: 'TRC20',
    walletAddress: resolvedWallet,
  });

  await sendMessage(chatId, msg, 'HTML');
}
