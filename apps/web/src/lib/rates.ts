import type { SupabaseClient } from '@supabase/supabase-js';
import { RATE_MAX_AGE_MINUTES } from '@/lib/constants';

/**
 * The BTC/USD price feed behind the Bitcoin rail.
 *
 * `create_order` prices every challenge in USD, so a BTC invoice has to be
 * converted at some rate. That rate lives in `app_config` (NOT in the request —
 * a caller-supplied rate would let someone buy a $549 challenge for a few
 * dollars) and is refreshed from a public, keyless exchange endpoint.
 *
 * Two guards keep a bad feed from becoming a bad quote, and the SQL function
 * re-applies both before it writes an order:
 *   * a sanity band, so a garbled number cannot become a plausible-looking
 *     price (1 BTC for $549 is a valid float);
 *   * freshness, so a dead feed stops new BTC orders instead of quoting
 *     yesterday's price.
 */

/** app_config keys. */
export const BTC_RATE_KEY = 'btc_usd_rate';
export const BTC_RATE_AT_KEY = 'btc_usd_rate_at';

/** Reject anything outside this band as a broken feed rather than a bargain. */
const MIN_PLAUSIBLE_RATE = 1_000;
const MAX_PLAUSIBLE_RATE = 10_000_000;

/** Keyless spot quote. Coinbase documents this endpoint as requiring no auth. */
const SPOT_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';

export interface BtcRate {
  rate: number;
  fetchedAt: string | null;
  /** Minutes since the quote was fetched, or null when there is no timestamp. */
  ageMinutes: number | null;
}

function parsePositiveNumber(raw: string | undefined | null): number | null {
  const text = (raw ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 ? value : null;
}

export function isRatePlausible(rate: number): boolean {
  return Number.isFinite(rate) && rate >= MIN_PLAUSIBLE_RATE && rate <= MAX_PLAUSIBLE_RATE;
}

/** The stored rate, with its age. Never throws: a read failure is "no rate". */
export async function readBtcRate(admin: SupabaseClient): Promise<BtcRate | null> {
  try {
    const { data } = await admin
      .from('app_config')
      .select('key,value')
      .in('key', [BTC_RATE_KEY, BTC_RATE_AT_KEY]);

    const rows = (data ?? []) as { key: string; value: string }[];
    const rate = parsePositiveNumber(rows.find((row) => row.key === BTC_RATE_KEY)?.value);
    if (rate === null) return null;

    const fetchedAtRaw = (rows.find((row) => row.key === BTC_RATE_AT_KEY)?.value ?? '').trim();
    const fetchedAtMs = fetchedAtRaw ? Date.parse(fetchedAtRaw) : NaN;

    return {
      rate,
      fetchedAt: fetchedAtRaw || null,
      ageMinutes: Number.isFinite(fetchedAtMs)
        ? Math.max(0, Math.round((Date.now() - fetchedAtMs) / 60_000))
        : null,
    };
  } catch (error) {
    console.error('btc rate read failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export function isRateFresh(rate: BtcRate | null): boolean {
  if (!rate || !isRatePlausible(rate.rate)) return false;
  if (rate.ageMinutes === null) return false;
  return rate.ageMinutes <= RATE_MAX_AGE_MINUTES;
}

export type RefreshResult =
  | { ok: true; rate: number; fetchedAt: string }
  | { ok: false; error: string };

/**
 * Fetch a fresh quote and persist it. Only the rate endpoint, the checkout
 * (when the stored rate has gone stale) and a scheduled job call this — the
 * value is written with the service role, so it is never browser-writable.
 */
export async function refreshBtcRate(admin: SupabaseClient): Promise<RefreshResult> {
  let quote: number | null = null;
  try {
    const res = await fetch(SPOT_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('btc spot quote returned', res.status);
    } else {
      const body = (await res.json()) as { data?: { amount?: unknown } };
      quote = parsePositiveNumber(
        typeof body?.data?.amount === 'string' || typeof body?.data?.amount === 'number'
          ? String(body.data.amount)
          : null,
      );
    }
  } catch (error) {
    console.error('btc spot quote failed:', error instanceof Error ? error.name : error);
  }

  if (quote === null) return { ok: false, error: 'quote_unavailable' };
  if (!isRatePlausible(quote)) {
    console.error(`btc spot quote outside the plausibility band: ${quote}`);
    return { ok: false, error: 'quote_implausible' };
  }

  const fetchedAt = new Date().toISOString();
  try {
    const { error } = await admin.from('app_config').upsert(
      [
        { key: BTC_RATE_KEY, value: String(quote), updated_at: fetchedAt },
        { key: BTC_RATE_AT_KEY, value: fetchedAt, updated_at: fetchedAt },
      ],
      { onConflict: 'key' },
    );
    if (error) {
      console.error('btc rate write failed:', error.message);
      return { ok: false, error: 'store_failed' };
    }
  } catch (error) {
    console.error('btc rate write failed:', error instanceof Error ? error.message : error);
    return { ok: false, error: 'store_failed' };
  }

  return { ok: true, rate: quote, fetchedAt };
}
