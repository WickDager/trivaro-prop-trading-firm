import type { ChallengePricing } from '@trivaro/shared-types';

export const APP_NAME = 'Trivaro';

// A malformed NEXT_PUBLIC_APP_URL must not fail the build. layout.tsx calls
// `new URL(APP_URL)` while Next collects page data, so a value saved without a
// scheme ("trivaro.com" rather than "https://trivaro.com") throws
// ERR_INVALID_URL and aborts the whole deploy. Accept a bare host, and fall
// back to localhost only when the value cannot be parsed at all.
function normalizeAppUrl(raw: string | undefined): string {
  const fallback = 'http://localhost:3000';
  const value = raw?.trim();
  if (!value) return fallback;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return fallback;
  }
}

export const APP_URL = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
export const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'TrivaroPayBot';

export const CHALLENGE_PRICING: ChallengePricing[] = [
  {
    accountSize: 5000,
    balanceChallenge: 45,
    equityChallenge: 39,
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 3,
    minTradingDays: 5,
  },
  {
    accountSize: 10000,
    balanceChallenge: 79,
    equityChallenge: 69,
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 3,
    minTradingDays: 5,
  },
  {
    accountSize: 25000,
    balanceChallenge: 159,
    equityChallenge: 139,
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 3,
    minTradingDays: 5,
  },
  {
    accountSize: 50000,
    balanceChallenge: 299,
    equityChallenge: 249,
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 3,
    minTradingDays: 5,
  },
  {
    accountSize: 75000,
    balanceChallenge: 424,
    equityChallenge: 349,
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 3,
    minTradingDays: 5,
  },
  {
    accountSize: 100000,
    balanceChallenge: 549,
    equityChallenge: 449,
    profitTarget: 8,
    maxDrawdown: 5,
    dailyDrawdown: 3,
    minTradingDays: 5,
  },
];

export const PAYMENT_TIMEOUT_MINUTES = 30;
export const CRYPTO_OFFSET_MIN = 0.01;
export const CRYPTO_OFFSET_MAX = 1.00;

export const NETWORK_INFO: Record<string, { name: string; fee: string; speed: string; priority: string }> = {
  TRC20: { name: 'TRC20 (Tron)', fee: '~$0', speed: '3 min', priority: 'Primary' },
  ERC20: { name: 'ERC20 (Ethereum)', fee: '~$3-8', speed: '5 min', priority: 'Backup' },
  BASE: { name: 'Base (Coinbase)', fee: '~$0.01', speed: '2 min', priority: 'Secondary' },
  BTC: { name: 'Bitcoin', fee: '~$2-5', speed: '10-30 min', priority: 'Tertiary' },
};
