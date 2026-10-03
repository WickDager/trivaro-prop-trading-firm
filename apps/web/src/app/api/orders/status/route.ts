import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/orders/status?payment_id=TV-2026-XXXXXX
 *
 * Returns the caller's own order status and, while it is still pending, asks
 * the `verify-payment` edge function to check the chain. The edge function is
 * the only thing that may flip an order to `paid`; this route never writes
 * that status itself.
 *
 * Scoped to the authenticated user at every step — a payment id is not a
 * secret (it is rendered in the URL the customer shares with the bot), so it
 * must never be sufficient to read an order.
 */

// Cheap per-instance throttle so a 15s client poll cannot hammer TronGrid.
// Keyed by payment id; entries are pruned on the way through.
const lastCheck = new Map<string, number>();
const CHECK_INTERVAL_MS = 20_000;
const MAX_ENTRIES = 5_000;

function shouldCheck(paymentId: string): boolean {
  const now = Date.now();
  if (lastCheck.size > MAX_ENTRIES) {
    for (const [key, at] of lastCheck) {
      if (now - at > CHECK_INTERVAL_MS) lastCheck.delete(key);
    }
  }
  const previous = lastCheck.get(paymentId) ?? 0;
  if (now - previous < CHECK_INTERVAL_MS) return false;
  lastCheck.set(paymentId, now);
  return true;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('payment_id');

    if (!paymentId) {
      return NextResponse.json({ error: 'payment_id is required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS already restricts this to the caller's rows; the explicit user_id
    // filter keeps the intent obvious.
    const { data: order, error } = await supabase
      .from('orders')
      .select('id,status,expires_at,payment_id')
      .eq('payment_id', paymentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Order lookup failed:', error.message);
      return NextResponse.json({ error: 'lookup_failed' }, { status: 500 });
    }
    if (!order) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (order.status !== 'pending') {
      return NextResponse.json({ status: order.status });
    }

    // Expiry is a server-side decision — never trust the client clock.
    if (order.expires_at && new Date(order.expires_at).getTime() < Date.now()) {
      const admin = createServiceClient();
      const { error: expireError } = await admin
        .from('orders')
        .update({ status: 'expired' })
        .eq('id', order.id)
        .eq('status', 'pending'); // guard: never clobber a concurrent 'paid'

      if (expireError) {
        console.error('Order expiry failed:', expireError.message);
      }
      return NextResponse.json({ status: 'expired' });
    }

    if (!shouldCheck(paymentId)) {
      return NextResponse.json({ status: order.status });
    }

    // Ask the verifier to look on-chain. A verifier outage must not change the
    // order's state or fail the request — the client simply keeps polling.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.EDGE_FUNCTION_API_KEY;
    if (!url || !key) {
      console.error('verify-payment not configured: missing SUPABASE_URL or EDGE_FUNCTION_API_KEY');
      return NextResponse.json({ status: order.status });
    }

    try {
      const res = await fetch(`${url}/functions/v1/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ payment_id: paymentId }),
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      });

      if (!res.ok) {
        console.error('verify-payment returned', res.status);
      }
    } catch (e) {
      console.error('verify-payment call failed:', e instanceof Error ? e.message : e);
    }

    // Re-read rather than trusting the verifier's response shape — the
    // database is the source of truth.
    const { data: updated } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .maybeSingle();

    return NextResponse.json({ status: updated?.status ?? order.status });
  } catch (e) {
    console.error('Order status error:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
