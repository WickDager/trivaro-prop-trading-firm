import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { paymentMessage } from '../templates/paymentMessage.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TELEGRAM_API = `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')!}`;

async function sendMessage(chatId: number, text: string, parseMode?: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function handleStart(chatId: number, payload: string, username?: string) {
  const paymentId = payload.replace('order_', '');

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_id', paymentId)
    .single();

  if (!order) {
    await sendMessage(chatId, '❌ Order not found. Please visit the website to create an order first.');
    return;
  }

  if (order.status !== 'pending') {
    await sendMessage(chatId, '❌ This order has already been processed.');
    return;
  }

  const walletAddress = Deno.env.get('HOT_WALLET_USDT_TRC20') || '';
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const offset = 0.01 + (arr[0] / 0xffffffff) * 0.99;
  const cryptoAmount = Number(order.amount_usd) + offset;

  await supabase
    .from('orders')
    .update({
      telegram_user_id: chatId,
      telegram_username: username,
      wallet_address: walletAddress,
      crypto_amount: cryptoAmount,
    })
    .eq('payment_id', paymentId);

  const msg = paymentMessage({
    paymentId,
    accountSize: order.account_size,
    amount: cryptoAmount,
    currency: 'USDT',
    network: 'TRC20',
    walletAddress,
  });

  await sendMessage(chatId, msg, 'Markdown');
}
