// ============================================================================
// /api/admin/data — reads the admin UI cannot do from the browser.
//
// Four tables have RLS enabled with no admin SELECT policy at all
// (notification_log, admin_credential_audit, login_history) or are
// service_role-only for inserts, and revenue grouping needs the full order
// history rather than a page of it. Everything else in the admin area is read
// directly with the cookie client under the existing `is_admin()` policies.
// ============================================================================

import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase';
import type { NextRequest } from 'next/server';

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function clampInt(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export async function GET(request: NextRequest) {
  const { supabase, supabaseResponse } = createServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const resource = params.get('resource') ?? '';
  const limit = clampInt(params.get('limit'), 50, 1, 500);
  const offset = clampInt(params.get('offset'), 0, 0, 100_000);
  const admin = createServiceClient();

  try {
    switch (resource) {
      case 'audit': {
        const { data, error, count } = await admin
          .from('admin_audit_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
        return NextResponse.json({ ok: true, rows: data ?? [], total: count ?? 0 });
      }

      case 'notifications': {
        const challengeId = params.get('challenge_id');
        let query = admin
          .from('notification_log')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (challengeId && UUID_RE.test(challengeId)) query = query.eq('challenge_id', challengeId);
        const { data, error, count } = await query;
        if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
        return NextResponse.json({ ok: true, rows: data ?? [], total: count ?? 0 });
      }

      case 'credential_audit': {
        const challengeId = params.get('challenge_id');
        let query = admin
          .from('admin_credential_audit')
          .select('*', { count: 'exact' })
          .order('acted_at', { ascending: false })
          .range(offset, offset + limit - 1);
        if (challengeId && UUID_RE.test(challengeId)) query = query.eq('challenge_id', challengeId);
        const { data, error, count } = await query;
        if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
        return NextResponse.json({ ok: true, rows: data ?? [], total: count ?? 0 });
      }

      case 'login_history': {
        const userId = params.get('user_id');
        if (!userId || !UUID_RE.test(userId)) {
          return NextResponse.json({ error: 'invalid_user_id' }, { status: 400 });
        }
        // Column names come from migration 008: the outcome is `status`
        // ('success' | 'failed') and the reason is `error_message`.
        const { data, error } = await admin
          .from('login_history')
          .select('id,user_id,email,provider,ip_address,user_agent,status,error_message,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
        return NextResponse.json({ ok: true, rows: data ?? [] });
      }

      case 'revenue': {
        const days = clampInt(params.get('days'), 30, 1, 365);
        const since = new Date(Date.now() - days * 86_400_000).toISOString();
        const { data, error } = await admin
          .from('orders')
          .select('id,amount_usd,crypto_currency,network,status,created_at,paid_at,account_size,challenge_type')
          .eq('status', 'paid')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .limit(5000);
        if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

        const orders = data ?? [];
        const byAsset = new Map<string, { currency: string; network: string; count: number; total: number }>();
        const byDay = new Map<string, number>();
        const bySize = new Map<number, { size: number; count: number; total: number }>();
        let total = 0;

        for (const order of orders) {
          const amount = Number(order.amount_usd) || 0;
          total += amount;

          const assetKey = `${order.crypto_currency ?? 'USDT'}-${order.network ?? 'TRC20'}`;
          const asset = byAsset.get(assetKey) ?? {
            currency: order.crypto_currency ?? 'USDT',
            network: order.network ?? 'TRC20',
            count: 0,
            total: 0,
          };
          asset.count += 1;
          asset.total += amount;
          byAsset.set(assetKey, asset);

          const day = String(order.created_at).slice(0, 10);
          byDay.set(day, (byDay.get(day) ?? 0) + amount);

          const size = Number(order.account_size) || 0;
          const bucket = bySize.get(size) ?? { size, count: 0, total: 0 };
          bucket.count += 1;
          bucket.total += amount;
          bySize.set(size, bucket);
        }

        return NextResponse.json({
          ok: true,
          days,
          total,
          orderCount: orders.length,
          average: orders.length ? total / orders.length : 0,
          byAsset: [...byAsset.values()].sort((a, b) => b.total - a.total),
          byDay: [...byDay.entries()].map(([date, amount]) => ({ date, amount })),
          bySize: [...bySize.values()].sort((a, b) => b.total - a.total),
        });
      }

      case 'system': {
        // Presence only — never the values. An admin needs to know whether a
        // verifier or mailer is configured, not what the key is.
        const configured = (name: string) => Boolean(process.env[name]);
        const { data: config } = await admin
          .from('app_config')
          .select('key,value,updated_at')
          .order('key', { ascending: true });
        const { data: prices } = await admin
          .from('challenge_prices')
          .select('account_size,challenge_type,price_usd')
          .order('account_size', { ascending: true });

        return NextResponse.json({
          ok: true,
          config: config ?? [],
          prices: prices ?? [],
          services: {
            supabase_secret_key: configured('SUPABASE_SECRET_KEY'),
            edge_function_api_key: configured('EDGE_FUNCTION_API_KEY'),
            trongrid_api_key: configured('TRONGRID_API_KEY'),
            etherscan_api_key: configured('ETHERSCAN_API_KEY'),
            blockcypher_token: configured('BLOCKCYPHER_TOKEN'),
            resend_api_key: configured('RESEND_API_KEY'),
            telegram_bot_token: configured('TELEGRAM_BOT_TOKEN'),
          },
        });
      }

      default:
        return NextResponse.json({ error: 'unknown_resource' }, { status: 400 });
    }
  } catch (e) {
    console.error('admin data request failed:', resource, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  } finally {
    void supabaseResponse;
  }
}
