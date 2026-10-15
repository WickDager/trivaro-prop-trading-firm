'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, type AdminColumn } from '@/components/admin/Table';
import { DefinitionList, SectionCard, StatCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, ConfirmActionButton, adminButtonClass } from '@/components/admin/Actions';
import {
  adminAction, challengeHealth, challengeStatusLabel, challengeStatusTone, credentialStatusLabel,
  credentialStatusTone, formatDate, formatDateTime, formatSeconds, kycLabel, kycTone, orderStatusTone,
  relativeTime, roleTone, secondsBetween, usd, usdCompact,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import {
  ArrowLeft, BadgeCheck, Ban, ExternalLink, KeyRound, Shield, ShieldOff, TrendingUp, Wallet,
} from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  telegram_username: string | null;
  telegram_id: number | null;
  role: string;
  kyc_status: string | null;
  created_at: string;
}

interface Challenge {
  id: string;
  account_number: string | null;
  status: string;
  starting_balance: number;
  current_equity: number | null;
  highest_equity: number | null;
  daily_peak_equity: number | null;
  daily_peak_date: string | null;
  phase_start_equity: number | null;
  profit_target: number;
  max_drawdown: number;
  daily_drawdown: number;
  trading_days: number;
  min_trading_days: number;
  last_trade_date: string | null;
  total_trades: number;
  winning_trades: number;
  is_trial: boolean;
  credential_status: string | null;
  created_at: string;
}

interface Order {
  id: string;
  payment_id: string;
  amount_usd: number;
  crypto_amount: number | null;
  crypto_currency: string | null;
  network: string | null;
  status: string;
  tx_hash: string | null;
  created_at: string;
}

interface Trade {
  id: string;
  challenge_id: string;
  symbol: string;
  type: string | null;
  lots: number | null;
  profit: number | null;
  open_time: string | null;
  close_time: string | null;
}

interface AuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface LoginEntry {
  id: string;
  provider: string | null;
  ip_address: string | null;
  user_agent: string | null;
  /** 'success' | 'failed' (migration 008). */
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function AdminTraderDetailPage() {
  const params = useParams();
  const userId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [logins, setLogins] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const supabase = createBrowserClient();

    const [profileRes, challengesRes, ordersRes, auditRes, loginsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('challenges')
        .select('id,account_number,status,starting_balance,current_equity,highest_equity,daily_peak_equity,daily_peak_date,phase_start_equity,profit_target,max_drawdown,daily_drawdown,trading_days,min_trading_days,last_trade_date,total_trades,winning_trades,is_trial,credential_status,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id,payment_id,amount_usd,crypto_amount,crypto_currency,network,status,tx_hash,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_audit_log')
        .select('id,action,target_type,target_id,details,created_at')
        .eq('target_type', 'user')
        .eq('target_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      fetch(`/api/admin/data?resource=login_history&user_id=${encodeURIComponent(userId)}&limit=10`, { cache: 'no-store' }),
    ]);

    if (profileRes.error || !profileRes.data) {
      setError(profileRes.error?.message ?? 'Trader not found.');
      setLoading(false);
      return;
    }

    const challengeRows = (challengesRes.data as Challenge[] | null) ?? [];
    setProfile(profileRes.data as unknown as Profile);
    setChallenges(challengeRows);
    setOrders((ordersRes.data as Order[] | null) ?? []);
    setAudit((auditRes.data as AuditEntry[] | null) ?? []);

    if (loginsRes.ok) {
      const body = (await loginsRes.json()) as { rows?: LoginEntry[] };
      setLogins(body.rows ?? []);
    }

    if (challengeRows.length) {
      const { data: tradeRows } = await supabase
        .from('trades')
        .select('id,challenge_id,symbol,type,lots,profit,open_time,close_time')
        .in('challenge_id', challengeRows.map((c) => c.id))
        .order('close_time', { ascending: false })
        .limit(50);
      setTrades((tradeRows as Trade[] | null) ?? []);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'paid');
    const live = challenges.filter((c) =>
      ['trial', 'active', 'phase1_complete', 'phase2_complete', 'funded'].includes(c.status),
    );
    const realised = trades.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
    return {
      paidVolume: paid.reduce((sum, o) => sum + (Number(o.amount_usd) || 0), 0),
      paidCount: paid.length,
      liveAccounts: live.length,
      funded: challenges.filter((c) => c.status === 'funded').length,
      realised,
      trades: trades.length,
    };
  }, [orders, challenges, trades]);

  async function act(
    action: string,
    payload: Record<string, unknown>,
    successMessage: string,
    apply: (next: Profile) => Profile,
  ) {
    const result = await adminAction(action, payload);
    if (!result.ok) return result;
    toast.success(successMessage);
    setProfile((prev) => (prev ? apply(prev) : prev));
    return result;
  }

  const accountColumns: AdminColumn<Challenge>[] = [
    {
      key: 'account',
      header: 'Account',
      primary: (row) => (
        <Link href={`/admin/challenges/${row.id}`} className="font-mono text-xs hover:text-amber-300">
          {row.account_number ?? row.id.slice(0, 8)}
        </Link>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/challenges/${row.id}`} className="font-mono text-xs hover:text-amber-300">
            {row.account_number ?? row.id.slice(0, 8)}
          </Link>
          <p className="text-[11px] text-text-muted">
            {row.is_trial ? 'Free trial' : usdCompact(row.starting_balance)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusPill tone={challengeStatusTone(row.status)}>{challengeStatusLabel(row.status)}</StatusPill>,
    },
    {
      key: 'equity',
      header: 'Equity',
      numeric: true,
      cell: (row) => (
        <span>
          {row.current_equity != null ? usd.format(row.current_equity) : '—'}
          <span className={challengeHealth(row).profitPct >= 0 ? 'text-green-400' : 'text-red-400'}>
            {' '}
            {challengeHealth(row).profitPct >= 0 ? '+' : ''}
            {challengeHealth(row).profitPct.toFixed(1)}%
          </span>
        </span>
      ),
    },
    {
      key: 'trades',
      header: 'Trades',
      numeric: true,
      cell: (row) => (
        <span>
          {row.total_trades}
          <span className="text-text-muted"> · {row.winning_trades}w</span>
        </span>
      ),
    },
    {
      key: 'credentials',
      header: 'Credentials',
      cell: (row) => (
        <StatusPill tone={credentialStatusTone(row.credential_status)}>
          {credentialStatusLabel(row.credential_status)}
        </StatusPill>
      ),
    },
  ];

  const orderColumns: AdminColumn<Order>[] = [
    {
      key: 'payment',
      header: 'Payment',
      primary: (row) => <span className="font-mono text-xs">{row.payment_id}</span>,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{row.payment_id}</p>
          <p className="text-[11px] text-text-muted">{formatDateTime(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'asset',
      header: 'Asset',
      cell: (row) => (
        <span className="text-xs">
          {row.crypto_currency ?? 'USDT'} <span className="text-text-muted">/ {row.network ?? 'TRC20'}</span>
        </span>
      ),
    },
    { key: 'amount', header: 'Amount', numeric: true, cell: (row) => usd.format(Number(row.amount_usd) || 0) },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusPill tone={orderStatusTone(row.status)}>{row.status}</StatusPill>,
    },
    {
      key: 'tx',
      header: 'Tx',
      desktopOnly: true,
      cell: (row) =>
        row.tx_hash ? (
          <code className="text-[11px] text-text-muted">{row.tx_hash.slice(0, 12)}…</code>
        ) : (
          <span className="text-[11px] text-text-muted">—</span>
        ),
    },
  ];

  const tradeColumns: AdminColumn<Trade>[] = [
    {
      key: 'symbol',
      header: 'Symbol',
      primary: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{row.symbol}</span>
          <StatusPill tone={row.type === 'buy' ? 'success' : 'danger'}>{row.type?.toUpperCase() ?? '—'}</StatusPill>
        </div>
      ),
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="text-sm">{row.symbol}</span>
          <StatusPill tone={row.type === 'buy' ? 'success' : 'danger'}>{row.type?.toUpperCase() ?? '—'}</StatusPill>
        </span>
      ),
    },
    { key: 'lots', header: 'Lots', numeric: true, cell: (row) => row.lots ?? '—' },
    {
      key: 'held',
      header: 'Held',
      cell: (row) => <span className="text-xs text-text-muted">{formatSeconds(secondsBetween(row.open_time, row.close_time))}</span>,
    },
    {
      key: 'profit',
      header: 'Profit',
      numeric: true,
      cell: (row) => (
        <span className={(Number(row.profit) || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
          {usd.format(Number(row.profit) || 0)}
        </span>
      ),
    },
    {
      key: 'closed',
      header: 'Closed',
      cell: (row) => <span className="text-xs text-text-muted">{formatDateTime(row.close_time)}</span>,
    },
  ];

  if (loading) {
    return <p className="py-16 text-center text-sm text-text-muted">Loading trader…</p>;
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Link href="/admin/traders" className={adminButtonClass('secondary')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          All traders
        </Link>
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error ?? 'Trader not found.'}
        </div>
      </div>
    );
  }

  const name =
    profile.full_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
    profile.email?.split('@')[0] ||
    'Unnamed trader';

  return (
    <div className="space-y-5">
      <Link href="/admin/traders" className={adminButtonClass('ghost', 'sm')}>
        <ArrowLeft className="h-3.5 w-3.5" />
        All traders
      </Link>

      <header className="rounded-xl border border-amber-500/10 bg-navy-700/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-lg font-bold">{name}</h1>
              <StatusPill tone={roleTone(profile.role)}>{profile.role}</StatusPill>
              <StatusPill tone={kycTone(profile.kyc_status)}>{kycLabel(profile.kyc_status)}</StatusPill>
            </div>
            <p className="mt-1 truncate text-sm text-text-secondary">{profile.email ?? 'no email on file'}</p>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Joined {formatDate(profile.created_at)} · id <code>{profile.id.slice(0, 8)}…</code>
              {profile.telegram_username ? ` · @${profile.telegram_username.replace(/^@/, '')}` : ''}
            </p>
          </div>

          {/* Actions wrap onto their own lines instead of stacking on top of
              each other; each button keeps its own error message. */}
          <div className="flex flex-wrap items-center gap-2">
            {profile.kyc_status !== 'verified' && (
              <AsyncButton
                variant="success"
                icon={BadgeCheck}
                onRun={() =>
                  act('set_kyc', { user_id: profile.id, status: 'verified' }, 'Trader verified', (prev) => ({
                    ...prev,
                    kyc_status: 'verified',
                  }))
                }
              >
                Verify identity
              </AsyncButton>
            )}
            {profile.kyc_status !== 'rejected' && (
              <AsyncButton
                variant="danger"
                icon={Ban}
                title="Reject the submitted identity details"
                onRun={() =>
                  act('set_kyc', { user_id: profile.id, status: 'rejected' }, 'Verification rejected', (prev) => ({
                    ...prev,
                    kyc_status: 'rejected',
                  }))
                }
              >
                Reject
              </AsyncButton>
            )}
            {profile.role === 'admin' ? (
              <ConfirmActionButton
                label="Remove admin"
                confirmLabel="Confirm removal"
                variant="secondary"
                icon={ShieldOff}
                onRun={() =>
                  act('set_role', { user_id: profile.id, role: 'trader' }, 'Admin access removed', (prev) => ({
                    ...prev,
                    role: 'trader',
                  }))
                }
              />
            ) : (
              <ConfirmActionButton
                label="Make admin"
                confirmLabel="Confirm promote"
                variant="secondary"
                icon={Shield}
                onRun={() =>
                  act('set_role', { user_id: profile.id, role: 'admin' }, 'Admin access granted', (prev) => ({
                    ...prev,
                    role: 'admin',
                  }))
                }
              />
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live accounts" value={stats.liveAccounts} hint={`${stats.funded} funded`} icon={TrendingUp} tone="info" />
        <StatCard
          label="Paid volume"
          value={usdCompact(stats.paidVolume)}
          hint={`${stats.paidCount} paid order${stats.paidCount === 1 ? '' : 's'}`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Realised P/L"
          value={usdCompact(stats.realised)}
          hint={`${stats.trades} recent trades`}
          icon={TrendingUp}
          tone={stats.realised >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="Last login"
          value={logins[0] ? relativeTime(logins[0].created_at) : '—'}
          hint={logins[0]?.ip_address ? `from ${logins[0].ip_address}` : 'no logins recorded'}
          icon={KeyRound}
          tone="neutral"
        />
      </div>

      <SectionCard
        title="Accounts"
        description="Every challenge this trader has held, with live monitoring."
        actions={
          <Link href={`/admin/challenges?q=${encodeURIComponent(profile.email ?? '')}`} className={adminButtonClass('secondary', 'sm')}>
            Filter in challenges
          </Link>
        }
      >
        <AdminTable
          rows={challenges}
          columns={accountColumns}
          getRowKey={(row) => row.id}
          empty={<p className="py-6 text-center text-xs text-text-muted">No accounts yet.</p>}
          actions={(row) => (
            <>
              {(!row.credential_status || row.credential_status === 'none') && (
                <AsyncButton
                  variant="primary"
                  icon={BadgeCheck}
                  title="Authorise this account and queue it for MT5 provisioning"
                  onRun={async () => {
                    const result = await adminAction('challenge_authorize', { challenge_id: row.id });
                    if (!result.ok) return result;
                    toast.success('Account authorised — queued for provisioning');
                    setChallenges((prev) =>
                      prev.map((c) => (c.id === row.id ? { ...c, credential_status: 'pending' } : c)),
                    );
                    return result;
                  }}
                >
                  Authorise
                </AsyncButton>
              )}
              <Link href={`/admin/challenges/${row.id}`} className={adminButtonClass('ghost', 'sm')}>
                <ExternalLink className="h-3.5 w-3.5" />
                Monitor
              </Link>
            </>
          )}
        />
      </SectionCard>

      <SectionCard title="Payments" description="Crypto orders raised by this trader.">
        <AdminTable
          rows={orders}
          columns={orderColumns}
          getRowKey={(row) => row.id}
          empty={<p className="py-6 text-center text-xs text-text-muted">No orders yet.</p>}
        />
      </SectionCard>

      <SectionCard title="Recent trades" description="Latest 50 closed trades across this trader's accounts.">
        <AdminTable
          rows={trades}
          columns={tradeColumns}
          getRowKey={(row) => row.id}
          empty={<p className="py-6 text-center text-xs text-text-muted">No trades received from the MT5 bridge yet.</p>}
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Login history" description="Most recent sign-in attempts.">
          {logins.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">No sign-in history recorded.</p>
          ) : (
            <ul className="divide-y divide-amber-500/5">
              {logins.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-xs">{entry.ip_address ?? 'unknown IP'}</p>
                    <p className="truncate text-[11px] text-text-muted">{entry.user_agent ?? 'unknown device'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill tone={entry.status === 'success' ? 'success' : 'danger'}>
                      {entry.status === 'success' ? 'success' : entry.error_message ?? 'failed'}
                    </StatusPill>
                    <span className="text-[11px] text-text-muted">{relativeTime(entry.created_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Admin trail" description="Privileged actions taken on this trader.">
          {audit.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">No admin actions recorded for this trader.</p>
          ) : (
            <ul className="divide-y divide-amber-500/5">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <StatusPill tone="warn">{entry.action.replace(/_/g, ' ')}</StatusPill>
                  <span className="text-[11px] text-text-muted">{formatDateTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Identity" description="Details held for this account.">
        <DefinitionList
          items={[
            { label: 'User id', value: <code className="text-xs">{profile.id}</code> },
            { label: 'Email', value: profile.email ?? '—' },
            { label: 'Full name', value: profile.full_name ?? '—' },
            { label: 'Telegram id', value: profile.telegram_id ?? '—' },
            { label: 'Role', value: profile.role },
            { label: 'KYC status', value: kycLabel(profile.kyc_status) },
          ]}
        />
      </SectionCard>
    </div>
  );
}
