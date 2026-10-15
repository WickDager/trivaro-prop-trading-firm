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

/**
 * Every cryptocurrency the platform can take, in ONE place.
 *
 * This used to be three drifting lists: the marketing copy said "USDT on
 * TRC20", the selector offered USDC-on-Base (which `create_order` rejects
 * outright — the RPC only allows TRC20/ERC20/BTC), and the checkout hard-coded
 * `USDT-${network}` as the selected key. Marketing copy, the selector, the
 * checkout and the admin reports all read from here now.
 *
 * `quotable` mirrors what `create_order` can actually price:
 *   * TRC20 / ERC20 are stablecoin rails, so the USD fee is the on-chain amount
 *     (1 token ≈ $1) — the same assumption `verify-payment` makes.
 *   * BTC has no FX quote in the order pipeline, so its USD-filled
 *     `crypto_amount` would be nonsense in satoshis. Listed as accepted but not
 *     quoteable rather than silently accepting an unpayable order.
 */
export interface CryptoAsset {
  currency: 'USDT' | 'USDC' | 'BTC';
  network: 'TRC20' | 'ERC20' | 'BTC';
  /** Customer-facing name, e.g. "USDT (Tron)". */
  label: string;
  /** Short network badge, e.g. "TRC20". */
  networkLabel: string;
  chain: string;
  /** Populated only on the stablecoin rails — there is no BTC quote. */
  decimals: number;
  fee: string;
  speed: string;
  /** Whether `create_order` can price this pair today. */
  quotable: boolean;
  /** Env var the verifier needs for this network, or null when its public API
   *  needs no key. Kept in the catalogue so /api/payments/methods can report
   *  readiness from one source. */
  verifierKey: string | null;
  /** `app_config` key holding the deposit address. */
  walletConfigKey: string;
}

export const SUPPORTED_CRYPTO: CryptoAsset[] = [
  {
    currency: 'USDT',
    network: 'TRC20',
    label: 'USDT (Tron)',
    networkLabel: 'TRC20',
    chain: 'Tron',
    decimals: 2,
    fee: '~$0 network fee',
    speed: '~1 minute',
    quotable: true,
    verifierKey: null,
    walletConfigKey: 'hot_wallet_trc20',
  },
  {
    currency: 'USDT',
    network: 'ERC20',
    label: 'USDT (Ethereum)',
    networkLabel: 'ERC20',
    chain: 'Ethereum',
    decimals: 2,
    fee: 'ETH gas applies',
    speed: '~5 minutes',
    quotable: true,
    verifierKey: 'ETHERSCAN_API_KEY',
    walletConfigKey: 'hot_wallet_erc20',
  },
  {
    currency: 'USDC',
    network: 'ERC20',
    label: 'USDC (Ethereum)',
    networkLabel: 'ERC20',
    chain: 'Ethereum',
    decimals: 2,
    fee: 'ETH gas applies',
    speed: '~5 minutes',
    quotable: true,
    verifierKey: 'ETHERSCAN_API_KEY',
    walletConfigKey: 'hot_wallet_erc20',
  },
  {
    currency: 'BTC',
    network: 'BTC',
    label: 'Bitcoin (on-chain)',
    networkLabel: 'BTC',
    chain: 'Bitcoin',
    decimals: 8,
    fee: 'network fee applies',
    speed: '~30 minutes',
    quotable: false,
    verifierKey: 'BLOCKCYPHER_TOKEN',
    walletConfigKey: 'hot_wallet_btc',
  },
];

export const NETWORK_INFO: Record<string, { name: string; fee: string; speed: string }> = Object.fromEntries(
  SUPPORTED_CRYPTO.map((asset) => [asset.network, { name: `${asset.networkLabel} (${asset.chain})`, fee: asset.fee, speed: asset.speed }]),
);

/** Stable key for a currency/network pair, e.g. `USDT-TRC20`. */
export function cryptoAssetKey(currency: string, network: string): string {
  return `${currency.toUpperCase()}-${network.toUpperCase()}`;
}

export function findCryptoAsset(currency: string, network: string): CryptoAsset | undefined {
  return SUPPORTED_CRYPTO.find(
    (asset) => asset.currency === currency.toUpperCase() && asset.network === network.toUpperCase(),
  );
}

/** The pairs we can quote and verify today, used as the offline fallback when
 *  /api/payments/methods has not answered yet. */
export const DEFAULT_ENABLED_NETWORKS = new Set(['TRC20']);
