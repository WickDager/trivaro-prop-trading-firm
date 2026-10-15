'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { SectionCard, StatCard, StatusPill, FilterChips, EmptyState } from '@/components/admin/Primitives';
import { adminButtonClass } from '@/components/admin/Actions';
import {
  usd, usdCompact, formatDateTime, relativeTime, orderStatusTone, challengeStatusLabel,
  challengeStatusTone, credentialStatusLabel, credentialStatusTone, kycLabel, kycTone,
} from '@/lib/admin';
import {
  Users, TrendingUp, CreditCard, KeyRound, Award, BadgeCheck, History,
  AlertTriangle, ArrowRight, RefreshCw, DollarSign,
} from 'lucide-react';

interface PendingOrder {
  id: string;
  payment_id: string;
  amount_usd: number;
  crypto_currency: string | null;
  network: string | null;
  created_at: string;
  expires_at: string | null;
}

interface ProvisionRow {
  id: string;
  account_number: string | null;
  starting_balance: number;
  status: string;
  is_trial: boolean;
  credential_status: string;
  user_id: string | null;
  created_at: string;
}

interface KycRow {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface FailedRow {
  id: string;
  status: string;
  starting_balance: number;
  updated_at: string;
  user_id: string | null;
}

interface Revenue {
  total: number;
  orderCount: number;
  average: number;
  byAsset: { currency: string; network: string; count: number; total: number }[];
  byDay: { date: string; amount: number }[];
  bySize: { size: number; count: number; total: number }[];
}

interface AuditRow {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  created_at: string;
}

interface Counts {
  traders: number;
  admins: number;
  active: number;
  trials: number;
  funded: number;
  failed: number;
  pendingOrders: number;
  kycPending: number;
  certificates: number;
}

const PERIODS = ['7', '30', '90'] as const;

const emptyCounts: Counts = {
  traders: 0, admins: 0, active: 0, trials: 0, funded: 0, failed: 0,
  pendingOrders: 0, kycPending: 0, certificates: 0,
};

export default function AdminOverviewPage() {
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [provisionQueue, setProvisionQueue] = useState<ProvisionRow[]>([]);
  const [kycQueue, setKycQueue] = useState<KycRow[]>([]);
  const [failed, setFailed] = useState<FailedRow[]>([]);
  const [emails, setEmails] = useState<{ id: string; email: string | null }[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [days, setDays] = useState<(typeof PERIODS)[number]>('30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (period: string) => {
      setError(null);
      const supabase = createBrowserClient();
      try {
        const [
          traders, admins, active, trials, funded, failedCount,
          pendingOrdersCount, kycPendingCount, certificates,
          orders, provisioning, kyc, recentFailures, revenueRes, auditRes,
        ] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'trader'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
          supabase.from('challenges').select('id', { count: 'exact', head: true }).in('status', ['active', 'phase1_complete', 'phase2_complete']),
          supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('is_trial', true),
          supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('status', 'funded'),
          supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
          supabase.from('certificates').select('id', { count: 'exact', head: true }),
          supabase
            .from('orders')
            .select('id,payment_id,amount_usd,crypto_currency,network,created_at,expires_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('challenges')
            .select('id,account_number,starting_balance,status,is_trial,credential_status,user_id,created_at')
            .in('credential_status', ['pending', 'provisioned'])
            .order('created_at', { ascending: true })
            .limit(5),
          supabase
            .from('profiles')
            .select('id,email,full_name,first_name,last_name,created_at')
            .eq('kyc_status', 'pending')
            .order('created_at', { ascending: true })
            .limit(5),
          supabase
            .from('challenges')
            .select('id,status,starting_balance,updated_at,user_id')
            .eq('status', 'failed')
            .order('updated_at', { ascending: false })
            .limit(5),
          fetch(`/api/admin/data?resource=revenue&days=${period}`, { cache: 'no-store' }),
          fetch('/api/admin/data?resource=audit&limit=8', { cache: 'no-store' }),
        ]);

        setCounts({
          traders: traders.count ?? 0,
          admins: admins.count ?? 0,
          active: active.count ?? 0,
          trials: trials.count ?? 0,
          funded: funded.count ?? 0,
          failed: failedCount.count ?? 0,
          pendingOrders: pendingOrdersCount.count ?? 0,
          kycPending: kycPendingCount.count ?? 0,
          certificates: certificates.count ?? 0,
        });

        setPendingOrders((orders.data as PendingOrder[] | null) ?? []);
        setProvisionQueue((provisioning.data as ProvisionRow[] | null) ?? []);
        setKycQueue((kyc.data as KycRow[] | null) ?? []);
        setFailed((recentFailures.data as FailedRow[] | null) ?? []);

        const userIds = Array.from(
          new Set(
            [...((recentFailures.data as FailedRow[] | null) ?? [])].map((r) => r.user_id).filter(Boolean),
          ),
        ) as string[];
        if (userIds.length) {
          const { data: profiles } = await supabase.from('profiles').select('id,email').in('id', userIds);
          setEmails((profiles as { id: string; email: string | null }[] | null) ?? []);
        } else {
          setEmails([]);
        }

        const revenueBody = revenueRes.ok ? ((await revenueRes.json()) as Revenue & { ok: boolean }) : null;
        setRevenue(revenueBody && revenueBody.ok ? revenueBody : null);

        const auditBody = auditRes.ok ? ((await auditRes.json()) as { rows?: AuditRow[] }) : null;
        setAudit(auditBody?.rows ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the dashboard.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const maxDay = revenue ? Math.max(1, ...revenue.byDay.map((d) => d.amount)) : 1;
  const attentionTotal = counts.pendingOrders + counts.kycPending + provisionQueue.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-text-muted">
            Traders, accounts, payments and everything waiting on a human.
          </p>
        </div>
        <button
          type="button"
          className={adminButtonClass('secondary')}
          onClick={() => {
            setRefreshing(true);
            void load(days);
          }}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ---- Headline numbers ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Traders"
          value={loading ? '…' : counts.traders}
          hint={`${counts.admins} admin${counts.admins === 1 ? '' : 's'} · ${counts.kycPending} awaiting KYC`}
          icon={Users}
          tone="info"
          href="/admin/traders"
        />
        <StatCard
          label="Live accounts"
          value={loading ? '…' : counts.active}
          hint={`${counts.trials} trial${counts.trials === 1 ? '' : 's'} · ${counts.funded} funded`}
          icon={TrendingUp}
          tone="success"
          href="/admin/challenges"
        />
        <StatCard
          label="Pending payments"
          value={loading ? '…' : counts.pendingOrders}
          hint="Unverified crypto orders"
          icon={CreditCard}
          tone={counts.pendingOrders > 0 ? 'warn' : 'neutral'}
          href="/admin/orders"
        />
        <StatCard
          label="Credential queue"
          value={loading ? '…' : provisionQueue.length}
          hint="Accounts awaiting MT5 setup or delivery"
          icon={KeyRound}
          tone={provisionQueue.length > 0 ? 'warn' : 'neutral'}
          href="/admin/provision"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Revenue (${days}d)`}
          value={revenue ? usdCompact(revenue.total) : '…'}
          hint={revenue ? `${revenue.orderCount} paid orders · ${usdCompact(revenue.average)} average` : 'Loading…'}
          icon={DollarSign}
          tone="success"
          href="/admin/orders"
        />
        <StatCard
          label="Failed accounts"
          value={loading ? '…' : counts.failed}
          hint="Total drawdown or rule breaches"
          icon={AlertTriangle}
          tone={counts.failed > 0 ? 'danger' : 'neutral'}
          href="/admin/challenges"
        />
        <StatCard
          label="Certificates issued"
          value={loading ? '…' : counts.certificates}
          hint="Passed and funded traders"
          icon={Award}
          tone="info"
          href="/admin/certificates"
        />
        <StatCard
          label="Needs attention"
          value={loading ? '…' : attentionTotal}
          hint="KYC, payments and provisioning combined"
          icon={BadgeCheck}
          tone={attentionTotal > 0 ? 'warn' : 'success'}
          href="/admin/verify"
        />
      </div>

      {/* ---- Revenue ---- */}
      <SectionCard
        title="Revenue"
        description="Paid challenge fees, grouped by the asset the customer paid with."
        actions={
          <FilterChips
            ariaLabel="Revenue period"
            options={PERIODS}
            value={days}
            onChange={setDays}
            labels={{ '7': '7 days', '30': '30 days', '90': '90 days' }}
          />
        }
      >
        {!revenue ? (
          <p className="py-6 text-center text-sm text-text-muted">Loading revenue…</p>
        ) : revenue.orderCount === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={`No paid orders in the last ${days} days`}
            description="Revenue appears here as soon as an on-chain payment is confirmed or an admin marks an order paid."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex h-20 items-end gap-1" role="img" aria-label="Daily revenue">
                {revenue.byDay.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${usd.format(day.amount)}`}
                    className="min-w-[3px] flex-1 rounded-t bg-amber-500/40 transition-colors hover:bg-amber-400/70"
                    style={{ height: `${Math.max(4, (day.amount / maxDay) * 100)}%` }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-text-muted">
                <span>{revenue.byDay[0]?.date}</span>
                <span>{revenue.byDay[revenue.byDay.length - 1]?.date}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-amber-500/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-500/10 text-left text-[11px] uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 font-medium">Asset</th>
                      <th className="px-3 py-2 text-right font-medium">Orders</th>
                      <th className="px-3 py-2 text-right font-medium">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.byAsset.map((asset) => (
                      <tr key={`${asset.currency}-${asset.network}`} className="border-b border-amber-500/5 last:border-0">
                        <td className="px-3 py-2">
                          {asset.currency} <span className="text-text-muted">on {asset.network}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{asset.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{usd.format(asset.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-amber-500/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-500/10 text-left text-[11px] uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 font-medium">Account size</th>
                      <th className="px-3 py-2 text-right font-medium">Sold</th>
                      <th className="px-3 py-2 text-right font-medium">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.bySize.map((size) => (
                      <tr key={size.size} className="border-b border-amber-500/5 last:border-0">
                        <td className="px-3 py-2">{usdCompact(size.size)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{size.count}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{usd.format(size.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ---- Attention queues ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Payments waiting on review"
          description="Pending crypto orders — confirm or cancel."
          actions={
            <Link href="/admin/orders" className={adminButtonClass('primary', 'sm')}>
              Open payments
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {pendingOrders.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">Nothing pending. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {pendingOrders.map((order) => (
                <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">{order.payment_id}</p>
                    <p className="text-[11px] text-text-muted">
                      {order.crypto_currency ?? 'USDT'} on {order.network ?? 'TRC20'} ·{' '}
                      {relativeTime(order.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums text-sm">{usd.format(Number(order.amount_usd) || 0)}</span>
                    <StatusPill tone={orderStatusTone('pending')}>pending</StatusPill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Accounts to provision"
          description="Paid or trial accounts that still need real MT5 credentials."
          actions={
            <Link href="/admin/provision" className={adminButtonClass('primary', 'sm')}>
              Open queue
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {provisionQueue.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">Provisioning queue is empty.</p>
          ) : (
            <ul className="space-y-2">
              {provisionQueue.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {row.is_trial ? 'Free trial' : `${usdCompact(row.starting_balance)} account`}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {row.account_number ?? 'no login yet'} · {challengeStatusLabel(row.status)}
                    </p>
                  </div>
                  <StatusPill tone={credentialStatusTone(row.credential_status)}>
                    {credentialStatusLabel(row.credential_status)}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Identity checks"
          description="Traders who submitted details and await verification."
          actions={
            <Link href="/admin/verify" className={adminButtonClass('primary', 'sm')}>
              Open verification
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {kycQueue.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">No identity checks outstanding.</p>
          ) : (
            <ul className="space-y-2">
              {kycQueue.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed trader'}
                    </p>
                    <p className="truncate text-[11px] text-text-muted">{row.email ?? 'no email'}</p>
                  </div>
                  <StatusPill tone={kycTone('pending')}>{kycLabel('pending')}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recently failed accounts"
          description="Breaches recorded by the risk engine."
          actions={
            <Link href="/admin/challenges?status=failed" className={adminButtonClass('primary', 'sm')}>
              Open challenges
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {failed.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">No failed accounts.</p>
          ) : (
            <ul className="space-y-2">
              {failed.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {emails.find((e) => e.id === row.user_id)?.email ?? 'Unknown trader'}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      {usdCompact(row.starting_balance)} · {relativeTime(row.updated_at)}
                    </p>
                  </div>
                  <StatusPill tone={challengeStatusTone('failed')}>failed</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ---- Audit trail ---- */}
      <SectionCard
        title="Recent admin activity"
        description="Every privileged action is recorded — role changes, payments, credentials, certificates."
        actions={
          <Link href="/admin/activity" className={adminButtonClass('secondary', 'sm')}>
            Full history
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        {audit.length === 0 ? (
          <EmptyState
            icon={History}
            title="No admin activity recorded yet"
            description="Actions taken from this panel — approving a payment, verifying a trader, provisioning credentials — appear here with the admin who performed them."
          />
        ) : (
          <ul className="divide-y divide-amber-500/5">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusPill tone="warn">{row.action.replace(/_/g, ' ')}</StatusPill>
                  <span className="truncate text-xs text-text-secondary">{row.target_type}</span>
                  <code className="hidden truncate text-[11px] text-text-muted sm:inline">{row.target_id}</code>
                </div>
                <span className="shrink-0 text-[11px] text-text-muted">{formatDateTime(row.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
