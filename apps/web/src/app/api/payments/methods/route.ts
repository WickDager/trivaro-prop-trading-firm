// ============================================================================
// GET /api/payments/methods — which crypto rails can actually be paid on.
//
// The checkout must never offer a network whose payment cannot be verified:
// accepting a USDC transfer while the ERC20 verifier has no Etherscan key would
// take the customer's money and never credit the order. Readiness therefore
// depends on data the browser cannot see (app_config deposit addresses, the
// verifier's required secrets — none today, every verifier is keyless — and for
// Bitcoin a fresh USD price), so it is computed here instead of being
// hard-coded in a component.
//
// Public on purpose: it exposes availability, never an address or a secret.
// ============================================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { SUPPORTED_CRYPTO, RATE_MAX_AGE_MINUTES } from '@/lib/constants';
import { isRateFresh, readBtcRate, refreshBtcRate } from '@/lib/rates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const walletKeys = Array.from(new Set(SUPPORTED_CRYPTO.map((asset) => asset.walletConfigKey)));
  const wallets: Record<string, string> = {};

  let admin: ReturnType<typeof createServiceClient> | null = null;
  try {
    admin = createServiceClient();
    const { data } = await admin.from('app_config').select('key,value').in('key', walletKeys);
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      if (typeof row.value === 'string') wallets[row.key] = row.value.trim();
    }
  } catch (e) {
    console.error('payment methods: app_config lookup failed:', e instanceof Error ? e.message : e);
  }

  // A rail whose price comes from a feed is only payable while that feed is
  // fresh — and only a current quote is published, never a historical one.
  let btcRate = admin ? await readBtcRate(admin) : null;
  let btcFresh = isRateFresh(btcRate);

  if (!btcFresh && admin) {
    // A stale feed is refreshed here, on the read that noticed it, so Bitcoin
    // is not left unavailable just because no scheduler happens to be running.
    // The response is cached for 60s, so this writes at most once a minute, and
    // the caller still gets the honest answer for the request in hand.
    const refreshed = await refreshBtcRate(admin);
    if (refreshed.ok) {
      btcRate = { rate: refreshed.rate, fetchedAt: refreshed.fetchedAt, ageMinutes: 0 };
      btcFresh = true;
    }
  }

  const methods = SUPPORTED_CRYPTO.map((asset) => {
    const wallet = wallets[asset.walletConfigKey];
    const walletReady = Boolean(wallet && !wallet.startsWith('REPLACE_ME'));
    // A null verifierKey means the rail's public API needs no key, so there is
    // nothing to configure (TronGrid, mempool.space and the Etherscan-shaped
    // mirrors used for USDC are all keyless).
    const verifierReady = asset.verifierKey ? Boolean(process.env[asset.verifierKey]) : true;
    const priceReady = asset.rateConfigKey ? btcFresh : true;
    const ready = walletReady && verifierReady && priceReady && asset.quotable;

    let reason: string | null = null;
    if (!asset.quotable) reason = 'Not available at checkout yet';
    else if (!walletReady) reason = 'Deposit address not configured';
    else if (!verifierReady) reason = 'Payment verification not configured';
    else if (!priceReady) reason = 'Price feed catching up — try again in a minute';

    return {
      currency: asset.currency,
      network: asset.network,
      label: asset.label,
      networkLabel: asset.networkLabel,
      chain: asset.chain,
      decimals: asset.decimals,
      fee: asset.fee,
      speed: asset.speed,
      minConfirmations: asset.minConfirmations,
      ready,
      reason,
      // Only the stablecoin rails are ~1:1 with USD; BTC's quote is published
      // so the checkout can show an estimate before an order exists.
      rate: asset.rateConfigKey ? (btcFresh ? btcRate?.rate ?? null : null) : 1,
      rateMaxAgeMinutes: asset.rateConfigKey ? RATE_MAX_AGE_MINUTES : null,
    };
  });

  return NextResponse.json(
    { methods, anyReady: methods.some((method) => method.ready) },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
