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

const MT5_API_SECRET = Deno.env.get('MT5_API_SECRET')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  // Auth check
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${MT5_API_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse and validate payload
  let payload: MT5Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.account_number || !Array.isArray(payload.trades) || payload.trades.length === 0) {
    return new Response(JSON.stringify({ error: 'account_number and trades[] required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Lookup challenge by account_number
  const { data: challenge, error: lookupErr } = await supabase
    .from('challenges')
    .select('id, status')
    .eq('account_number', payload.account_number)
    .single();

  if (lookupErr || !challenge) {
    return new Response(JSON.stringify({ error: 'unknown_account', account_number: payload.account_number }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (challenge.status !== 'active' && challenge.status !== 'phase1_complete' && challenge.status !== 'phase2_complete') {
    return new Response(JSON.stringify({ error: 'challenge_not_active', status: challenge.status }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Deduplicate by MT5 ticket number
  const tickets = payload.trades.map((t) => String(t.ticket));
  const { data: existing } = await supabase
    .from('trades')
    .select('external_id')
    .in('external_id', tickets);

  const existingIds = new Set((existing ?? []).map((e: { external_id: string | null }) => e.external_id));
  const newTrades = payload.trades.filter((t) => !existingIds.has(String(t.ticket)));

  if (newTrades.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: 'all trades already recorded', count: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate each trade
  for (const t of newTrades) {
    if (!t.ticket || !t.symbol || !t.type || !t.lots || t.profit === undefined) {
      return new Response(JSON.stringify({ error: 'invalid_trade', ticket: t.ticket }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (t.type !== 'buy' && t.type !== 'sell') {
      return new Response(JSON.stringify({ error: 'invalid_type', ticket: t.ticket, type: t.type }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Batch insert
  const rows = newTrades.map((t) => ({
    challenge_id: challenge.id,
    external_id: String(t.ticket),
    symbol: t.symbol,
    type: t.type,
    lots: t.lots,
    open_price: t.open_price ?? null,
    close_price: t.close_price ?? null,
    profit: t.profit,
    open_time: t.open_time ?? null,
    close_time: t.close_time ?? null,
  }));

  const { error: insertErr } = await supabase.from('trades').insert(rows);

  if (insertErr) {
    console.error('Insert error:', insertErr.message);
    return new Response(JSON.stringify({ error: 'insert_failed', details: insertErr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    inserted: newTrades.length,
    skipped: payload.trades.length - newTrades.length,
  }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
});
