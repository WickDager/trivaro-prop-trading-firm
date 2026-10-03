import { escapeHtml } from '../services/telegram.ts';

interface SuccessMessageParams {
  accountNumber: string;
  accountPassword: string;
  server: string;
  accountSize: number;
}

// HTML parse mode: credentials often contain Markdown metacharacters (`_`,
// `*`, `.`), which under legacy Markdown made Telegram reject the message with
// 400 — the user paid and then never received their login details.
export function successMessage(params: SuccessMessageParams): string {
  return [
    `✅ <b>Challenge Activated!</b>`,
    ``,
    `🎉 Your $${(params.accountSize / 1000).toFixed(0)}K funded account is ready.`,
    ``,
    `📊 <b>Account Details:</b>`,
    `Account: <code>${escapeHtml(params.accountNumber)}</code>`,
    `Password: <code>${escapeHtml(params.accountPassword)}</code>`,
    `Server: <code>${escapeHtml(params.server)}</code>`,
    ``,
    `📋 <b>Challenge Rules:</b>`,
    `• 8% Profit Target`,
    `• 5% Max Drawdown`,
    `• 3% Daily Drawdown`,
    `• 5 Minimum Trading Days`,
    ``,
    `Good luck! 🚀`,
  ].join('\n');
}
