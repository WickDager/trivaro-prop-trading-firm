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
 * Marketing copy, the selector, the checkout, /api/payments/methods and the
 * admin reports all read from here, so a rail cannot be advertised on one page
 * and rejected by the order pipeline on another.
 *
 * The three rails, and why exactly these three:
 *
 *   USDT  TRC20   Tether on Tron. Cheap and fast; the verifier reads TronGrid
 *                 with no API key.
 *   USDC  ERC20   Circle's USDC on Ethereum. USDT is deliberately NOT offered
 *                 on Ethereum (one token per chain keeps "which contract did
 *                 the customer send?" answerable); USDC on Tron is not offered
 *                 either because Circle discontinued USDC-on-Tron in 2024, so
 *                 an address holding "USDC" there is not Circle's token.
 *   BTC   BTC     Native Bitcoin, priced from a stored FX rate (see
 *                 RATE_MAX_AGE_MINUTES) because the fee is quoted in USD.
 *
 * NO rail needs an API key to be verified, and that is deliberate: a missing
 * secret must never silently disable a way to pay. USDT-TRC20 is read from
 * TronGrid, BTC from mempool.space / Blockstream Esplora, and USDC from
 * Etherscan-shaped explorers that answer without a key (Routescan, then
 * Blockscout). `verifierKey` therefore documents a PREFERRED key, not a
 * required one: an `ETHERSCAN_API_KEY` is used first for Ethereum when it is
 * set, and every rail declares null so /api/payments/methods cannot hide a rail
 * for want of a secret (ERC20 only ever needed one because Etherscan retired
 * its keyless v1 endpoint on 2025-08-15).
 */
export interface CryptoAsset {
  currency: 'USDT' | 'USDC' | 'BTC';
  network: 'TRC20' | 'ERC20' | 'BTC';
  /** Customer-facing name, e.g. "USDT (Tron)". */
  label: string;
  /** Short network badge, e.g. "TRC20". */
  networkLabel: string;
  chain: string;
  /** Decimal places the invoice amount is displayed and verified with. */
  decimals: number;
  fee: string;
  speed: string;
  /** Confirmed blocks/hashes the verifier requires before crediting. */
  minConfirmations: number;
  /** Whether `create_order` can price this pair today. */
  quotable: boolean;
  /** Env var the verifier PREFERS for this network, or null when its public API
   *  needs no key at all. Kept in the catalogue so /api/payments/methods can
   *  report readiness from one source; no rail sets it today, because every
   *  verifier has a keyless path. */
  verifierKey: string | null;
  /** `app_config` key that must hold a fresh USD price before this rail can be
   *  quoted (BTC only), or null for the ~1:1 stablecoin rails. */
  rateConfigKey: string | null;
  /** `app_config` key holding the deposit address. */
  walletConfigKey: string;
}

/** A BTC quote older than this is refused: the customer would pay an amount
 *  that no longer matches the USD price the order was placed at. Two hours is
 *  far longer than the 30-minute payment window and short enough that a dead
 *  price feed fails closed instead of quoting last week's rate. */
export const RATE_MAX_AGE_MINUTES = 120;

export const SUPPORTED_CRYPTO: CryptoAsset[] = [
  {
    currency: 'USDT',
    network: 'TRC20',
    label: 'USDT (Tron)',
    networkLabel: 'TRC20',
    chain: 'Tron',
    decimals: 2,
    fee: 'Tron network fee',
    speed: '~1 minute',
    minConfirmations: 2,
    quotable: true,
    verifierKey: null,
    rateConfigKey: null,
    walletConfigKey: 'hot_wallet_trc20',
  },
  {
    currency: 'USDC',
    network: 'ERC20',
    label: 'USDC (Ethereum)',
    networkLabel: 'ERC20',
    chain: 'Ethereum',
    decimals: 2,
    fee: 'Ethereum gas fee',
    speed: '~2 minutes',
    minConfirmations: 2,
    quotable: true,
    // Keyless: the verifier reads Etherscan-shaped mirrors (Routescan, then
    // Blockscout) and only prefers Etherscan v2 if a key happens to be set.
    verifierKey: null,
    rateConfigKey: null,
    walletConfigKey: 'hot_wallet_erc20',
  },
  {
    currency: 'BTC',
    network: 'BTC',
    label: 'Bitcoin (on-chain)',
    networkLabel: 'BTC',
    chain: 'Bitcoin',
    decimals: 8,
    fee: 'Bitcoin network fee',
    speed: '~30-60 minutes',
    minConfirmations: 2,
    quotable: true,
    verifierKey: null,
    rateConfigKey: 'btc_usd_rate',
    walletConfigKey: 'hot_wallet_btc',
  },
];

/**
 * Satoshi spread of the USD "identifying offset".
 *
 * Every order adds a random $0.01–$0.99 so the exact amount identifies the
 * payment on chain. That offset converts to satoshi differently per rate — at
 * $100k/BTC, $0.01 is 10 satoshi — so the BTC tolerance must stay well under
 * the smallest possible gap between two orders, or one payment could match two
 * pending orders. See BTC_AMOUNT_TOLERANCE_SAT in the verifier.
 */
export const BTC_TOLERANCE_SATS = 5;

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
 *  /api/payments/methods has not answered yet. BTC is deliberately absent: it
 *  cannot be quoted without a fresh stored rate, which only the API can report. */
export const DEFAULT_ENABLED_NETWORKS = new Set(['TRC20', 'ERC20']);
