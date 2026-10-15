// ============================================================================
// GET /api/payments/methods — which crypto rails can actually be paid on.
//
// The checkout must never offer a network whose payment cannot be verified:
// accepting a USDT-ERC20 transfer while the ERC20 verifier has no API key would
// take the customer's money and never credit the order. Readiness therefore
// depends on data the browser cannot see (app_config deposit addresses and the
// verifier's API key), so it is computed here instead of being hard-coded in a
// component.
//
// Public on purpose: it exposes availability, never an address or a secret.
// ============================================================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { SUPPORTED_CRYPTO } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const walletKeys = Array.from(new Set(SUPPORTED_CRYPTO.map((asset) => asset.walletConfigKey)));
  const wallets: Record<string, string> = {};

  try {
    const admin = createServiceClient();
    const { data } = await admin.from('app_config').select('key,value').in('key', walletKeys);
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      if (typeof row.value === 'string') wallets[row.key] = row.value.trim();
    }
  } catch (e) {
    console.error('payment methods: app_config lookup failed:', e instanceof Error ? e.message : e);
  }

  const methods = SUPPORTED_CRYPTO.map((asset) => {
    const wallet = wallets[asset.walletConfigKey];
    const walletReady = Boolean(wallet && !wallet.startsWith('REPLACE_ME'));
    const verifierReady = asset.verifierKey ? Boolean(process.env[asset.verifierKey]) : true;
    // A quotable rail is only offered when its deposit address exists AND its
    // verifier is configured.
    const ready = walletReady && verifierReady && asset.quotable;

    let reason: string | null = null;
    if (!asset.quotable) reason = 'Not available at checkout yet';
    else if (!walletReady) reason = 'Deposit address not configured';
    else if (!verifierReady) reason = 'Payment verification not configured';

    return {
      currency: asset.currency,
      network: asset.network,
      label: asset.label,
      networkLabel: asset.networkLabel,
      chain: asset.chain,
      decimals: asset.decimals,
      fee: asset.fee,
      speed: asset.speed,
      ready,
      reason,
    };
  });

  return NextResponse.json(
    { methods, anyReady: methods.some((method) => method.ready) },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
