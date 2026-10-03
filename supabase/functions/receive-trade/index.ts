// ============================================================================
// receive-trade — ingests closed MT5 trades from the bridge.
//
// Caller: bridge/mt5_bridge.py, authenticated with a shared secret.
//
// NOTE: deployed functions belonging to this project also exist at
// D:\trivaro-prop-trading-firm\supabase\functions\. Keep the two copies in
// sync — only this one is under version control.
// ============================================================================

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

interface MT5Trade {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  open_price: number;
  close_price: number;
  profit: number;
  open_time: string;
  close_time: string;
}

interface MT5Payload {
  account_number: string;
  trades: MT5Trade[];
}

/** A single request may not insert an unbounded number of rows. */
const MAX_TRADES_PER_REQUEST = 500;

/** Statuses that may still accrue trades — includes 'trial' (migration 016). */
const INGESTIBLE_STATUSES = new Set(['trial', 'active', 'phase1_complete', 'phase2_complete']);

const MT5_API_SECRET = Deno.env.get('MT5_API_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Constant-time comparison. Hash both sides first so the comparison is always
 * over equal-length inputs.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(ha, hb);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // ---------------------------------------------------------------------
  // Auth — fail CLOSED.
  // `Deno.env.get('X')!` is a TypeScript assertion, not a runtime check: if
  // the variable is unset it stringifies to "undefined" and the old check
  // `authHeader !== \`Bearer ${MT5_API_SECRET}\`` then PASSED for anyone
  // sending literally "Authorization: Bearer undefined".
  // ---------------------------------------------------------------------
  if (!MT5_API_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('receive-trade misconfigured: missing required environment variables');
    return json({ error: 'server_misconfigured' }, 500);
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!(await timingSafeEqual(authHeader, `Bearer ${MT5_API_SECRET}`))) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---------------------------------------------------------------------
  // Parse
  // ---------------------------------------------------------------------
  let payload: MT5Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!payload.account_number || !Array.isArray(payload.trades) || payload.trades.length === 0) {
    return json({ error: 'account_number and trades[] required' }, 400);
  }

  if (payload.trades.length > MAX_TRADES_PER_REQUEST) {
    return json(
      { error: 'batch_too_large', max: MAX_TRADES_PER_REQUEST, got: payload.trades.length },
      413,
    );
  }

  // ---------------------------------------------------------------------
  // Resolve the challenge
  // ---------------------------------------------------------------------
  const { data: challenge, error: lookupErr } = await supabase
    .from('challenges')
    .select('id, status')
    .eq('account_number', payload.account_number)
    .maybeSingle();

  if (lookupErr) {
    console.error('challenge lookup failed:', lookupErr.message);
    return json({ error: 'lookup_failed' }, 500);
  }

  if (!challenge) {
    return json({ error: 'unknown_account' }, 404);
  }

  if (!INGESTIBLE_STATUSES.has(String(challenge.status))) {
    return json({ error: 'challenge_not_active', status: challenge.status }, 409);
  }

  // ---------------------------------------------------------------------
  // Validate every trade before writing anything
  // ---------------------------------------------------------------------
  for (const t of payload.trades) {
    // `!t.lots` rejected a legitimate lots: 0, and `t.profit === undefined`
    // accepted null. Check types explicitly instead of relying on truthiness.
    if (!Number.isInteger(t.ticket) ||
        typeof t.symbol !== 'string' || t.symbol.length === 0 ||
        (t.type !== 'buy' && t.type !== 'sell') ||
        !Number.isFinite(t.lots) || t.lots < 0 || t.lots > 1000 ||
        !Number.isFinite(t.profit) || Math.abs(t.profit) > 1e9 ||
        !Number.isFinite(t.open_price) || !Number.isFinite(t.close_price)) {
      return json({ error: 'invalid_trade', ticket: t.ticket }, 400);
    }
  }

  // ---------------------------------------------------------------------
  // Insert
  // ---------------------------------------------------------------------
  // Dedupe is scoped to THIS challenge. MT5 deal tickets are unique only per
  // broker/account, so a global `external_id` check made one account's ticket
  // silently discard another account's genuine trade.
  //
  // The upsert is also atomic, replacing the old check-then-insert, which lost
  // the race between two concurrent bridge runs. It relies on the
  // `trades_challenge_external_id_key` unique index added in migration 013.
  const rows = payload.trades.map((t) => ({
    challenge_id: challenge.id,
    external_id: String(t.ticket),
    symbol: t.symbol,
    type: t.type,
    lots: t.lots,
    open_price: t.open_price,
    close_price: t.close_price,
    profit: t.profit,
    open_time: t.open_time,
    close_time: t.close_time,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('trades')
    .upsert(rows, { onConflict: 'challenge_id,external_id', ignoreDuplicates: true })
    .select('id');

  if (insertErr) {
    // Log the detail; do not return driver/constraint text to the caller.
    console.error('trade insert failed:', insertErr.message);
    return json({ error: 'insert_failed' }, 500);
  }

  const insertedCount = inserted?.length ?? 0;

  return json(
    {
      ok: true,
      inserted: insertedCount,
      skipped: payload.trades.length - insertedCount,
    },
    201,
  );
});
