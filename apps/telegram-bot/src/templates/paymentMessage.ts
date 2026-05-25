interface PaymentMessageParams {
  paymentId: string;
  accountSize: number;
  amount: number;
  currency: string;
  network: string;
  walletAddress: string;
}

export function paymentMessage(params: PaymentMessageParams): string {
  return [
    `🧾 *Payment Invoice*`,
    ``,
    `📋 Order: \`${params.paymentId}\``,
    `📊 Account: $${(params.accountSize / 1000).toFixed(0)}K`,
    `💰 Amount: \`${params.amount.toFixed(2)} ${params.currency} (${params.network})\``,
    ``,
    `📤 *Send to:*`,
    `\`${params.walletAddress}\``,
    ``,
    `⏱ Expires: 30 minutes`,
    ``,
    `⚠️ Send *exactly* ${params.amount.toFixed(2)} ${params.currency} on ${params.network} network.`,
    `We only accept USDT on TRC20. Other currencies or networks will not be verified.`,
    ``,
    `After sending, your account will be automatically activated.`,
  ].join('\n');
}
