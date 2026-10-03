import { escapeHtml } from '../services/telegram.ts';

interface PaymentMessageParams {
  paymentId: string;
  accountSize: number;
  amount: number;
  currency: string;
  network: string;
  walletAddress: string;
}

/** Show the exact quoted amount (sub-cent offsets included) without trailing zeros. */
function formatAmount(amount: number): string {
  return amount
    .toFixed(6)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}

// HTML parse mode: every interpolated value is escaped, because an unbalanced
// Markdown entity made Telegram reject the message with 400 and the user never
// received the wallet address at all.
export function paymentMessage(params: PaymentMessageParams): string {
  const amount = formatAmount(params.amount);
  return [
    `🧾 <b>Payment Invoice</b>`,
    ``,
    `📋 Order: <code>${escapeHtml(params.paymentId)}</code>`,
    `📊 Account: $${(params.accountSize / 1000).toFixed(0)}K`,
    `💰 Amount: <code>${amount} ${escapeHtml(params.currency)} (${escapeHtml(params.network)})</code>`,
    ``,
    `📤 <b>Send to:</b>`,
    `<code>${escapeHtml(params.walletAddress)}</code>`,
    ``,
    `⏱ Expires: 30 minutes`,
    ``,
    `⚠️ Send <b>exactly</b> ${amount} ${escapeHtml(params.currency)} on ${escapeHtml(params.network)} network.`,
    `We only accept USDT on TRC20. Other currencies or networks will not be verified.`,
    ``,
    `After sending, your account will be automatically activated.`,
  ].join('\n');
}
