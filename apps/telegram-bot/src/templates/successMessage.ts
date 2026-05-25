interface SuccessMessageParams {
  accountNumber: string;
  accountPassword: string;
  server: string;
  accountSize: number;
}

export function successMessage(params: SuccessMessageParams): string {
  return [
    `✅ *Challenge Activated!*`,
    ``,
    `🎉 Your $${(params.accountSize / 1000).toFixed(0)}K funded account is ready.`,
    ``,
    `📊 *Account Details:*`,
    `Account: \`${params.accountNumber}\``,
    `Password: \`${params.accountPassword}\``,
    `Server: \`${params.server}\``,
    ``,
    `📋 *Challenge Rules:*`,
    `• 8% Profit Target`,
    `• 5% Max Drawdown`,
    `• 3% Daily Drawdown`,
    `• 5 Minimum Trading Days`,
    ``,
    `Good luck! 🚀`,
  ].join('\n');
}
