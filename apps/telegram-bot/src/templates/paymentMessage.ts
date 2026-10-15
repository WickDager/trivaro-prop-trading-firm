import { escapeHtml } from '../services/telegram.ts';

interface PaymentMessageParams {
  paymentId: string;
  accountSize: number;
  amount: number;
  currency: string;
  network: string;
  /** Display name of the chain, e.g. "Tron". Optional so an older caller keeps
   *  compiling; the message falls back to Tron, which is what the bot quotes. */
  chain?: string;
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
    // Deliberately scoped to THIS order rather than "we only accept USDT on
    // TRC20": the bot quotes Tron, but the platform also takes USDT/USDC on
    // Ethereum and Bitcoin, so the blanket claim contradicted the website.
    `This order is quoted in ${escapeHtml(params.currency)} on the ${escapeHtml(params.network)} network (${escapeHtml(params.chain ?? 'Tron')}). Sending from any other network cannot be matched to this order.`,
    ``,
    `After sending, your account will be automatically activated.`,
  ].join('\n');
}
