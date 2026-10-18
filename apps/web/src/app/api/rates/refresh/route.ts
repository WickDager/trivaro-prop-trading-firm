// ============================================================================
// POST /api/rates/refresh — refresh the BTC/USD quote used to price the
// Bitcoin rail.
//
// Guarded by `Authorization: Bearer <CRON_SECRET or EDGE_FUNCTION_API_KEY>`
// because it writes to `app_config` with the service role. It fails CLOSED when
// neither secret is configured: an unauthenticated endpoint that lets anyone
// redraw the price of every Bitcoin order is worse than having no endpoint.
//
// The checkout does not depend on a scheduler — it refreshes a stale quote
// itself — but wiring this to a cron keeps BTC purchasable without a customer
// having to be the first person to try.
// ============================================================================

import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase';
import { refreshBtcRate } from '@/lib/rates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sharedSecret(): string | null {
  return process.env.CRON_SECRET || process.env.EDGE_FUNCTION_API_KEY || null;
}

/**
 * Constant-time comparison over fixed-length digests. `!==` short-circuits on
 * the first differing byte, which leaks the secret's prefix through timing —
 * the same reason every other secret check in this repo hashes first.
 */
function secretMatches(presented: string, expected: string): boolean {
  const digestA = createHash('sha256').update(presented).digest();
  const digestB = createHash('sha256').update(expected).digest();
  return nodeTimingSafeEqual(digestA, digestB);
}

export async function POST(request: Request) {
  const secret = sharedSecret();
  if (!secret) {
    console.error('rates/refresh: neither CRON_SECRET nor EDGE_FUNCTION_API_KEY is set');
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') ?? '';
  if (!secretMatches(authorization, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const admin = createServiceClient();
    const result = await refreshBtcRate(admin);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }
    return NextResponse.json(
      { ok: true, rate: result.rate, fetched_at: result.fetchedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error('rates/refresh failed:', message);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
