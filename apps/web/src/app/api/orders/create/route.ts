// ============================================================================
// POST /api/orders/create — create the customer's order and return the exact
// amount and deposit address to pay.
//
// WHY THIS EXISTS AT ALL: the browser used to call `create_order` directly.
// That works for the ~1:1 stablecoin rails, but a BTC invoice has to be priced
// from a USD rate, and the rate is only allowed to come from the server. This
// route refreshes a stale quote and *then* calls the same RPC, so the amount
// the customer is shown is always derived from a rate the server trusts.
//
// The RPC stays the authority: it re-validates the currency/network pair, the
// deposit address and the rate's freshness, and it is the only writer of
// `orders` (migration 021). This route can therefore not be used to invent an
// order — only to ask for one.
// ============================================================================

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase';
import { SUPPORTED_CRYPTO, findCryptoAsset } from '@/lib/constants';
import { isRateFresh, readBtcRate, refreshBtcRate } from '@/lib/rates';
import { isSameOrigin } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Messages `create_order` raises with a friendly `raise exception`. Anything
 * else (a permission error, a missing column) is replaced with a generic
 * message instead of being shown to the customer.
 */
const EXPLAINABLE_ERRORS = [
  'USDT is only accepted on TRC20',
  'unsupported payment rail',
  'deposit address',
  'Bitcoin price',
  'could not allocate',
];

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | { account_size?: unknown; challenge_type?: unknown; network?: unknown; currency?: unknown }
      | null;
    if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

    const accountSize = Number(body.account_size);
    const challengeType = body.challenge_type === 'balance' ? 'balance' : 'equity';
    const network = typeof body.network === 'string' ? body.network.toUpperCase() : '';
    const currency = typeof body.currency === 'string' ? body.currency.toUpperCase() : '';

    if (!Number.isInteger(accountSize) || accountSize <= 0) {
      return NextResponse.json({ error: 'invalid_account_size' }, { status: 400 });
    }

    const asset = findCryptoAsset(currency, network);
    if (!asset || !SUPPORTED_CRYPTO.includes(asset) || !asset.quotable) {
      return NextResponse.json({ error: 'unsupported_rail' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    // ---- Bitcoin needs a fresh price before it can be quoted -------------
    if (asset.rateConfigKey) {
      let admin;
      try {
        admin = createServiceClient();
      } catch (error) {
        console.error('orders/create: service client unavailable:', error instanceof Error ? error.message : error);
        return NextResponse.json({ error: 'rate_unavailable' }, { status: 503 });
      }

      const stored = await readBtcRate(admin);
      if (!isRateFresh(stored)) {
        const refreshed = await refreshBtcRate(admin);
        if (!refreshed.ok) {
          // Do not invent a price: the customer is told to come back rather
          // than being invoiced at a rate nobody can stand behind.
          return NextResponse.json(
            { error: 'rate_unavailable', detail: 'The Bitcoin price feed is unavailable.' },
            { status: 503 },
          );
        }
      }
    }

    const { data, error } = await supabase.rpc('create_order', {
      p_account_size: accountSize,
      p_challenge_type: challengeType,
      p_network: asset.network,
      p_crypto_currency: asset.currency,
    });

    if (error) {
      const explainable = EXPLAINABLE_ERRORS.some((fragment) => error.message.includes(fragment));
      console.error('create_order failed:', error.code, error.message.slice(0, 160));
      return NextResponse.json(
        { error: 'order_failed', detail: explainable ? error.message : 'Could not create your order.' },
        { status: 409 },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return NextResponse.json({ error: 'order_failed', detail: 'Could not create your order.' }, { status: 500 });
    }

    return NextResponse.json(
      { ok: true, order: row, asset: { currency: asset.currency, network: asset.network, decimals: asset.decimals, label: asset.label } },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('orders/create error:', message);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
