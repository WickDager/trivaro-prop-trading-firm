'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, type AdminColumn } from '@/components/admin/Table';
import { DefinitionList, ProgressBar, SectionCard, StatCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, ConfirmActionButton, adminButtonClass } from '@/components/admin/Actions';
import { EquityChart } from '@/components/dashboard/EquityChart';
import {
  adminAction, challengeHealth, challengeStatusLabel, challengeStatusTone, credentialStatusLabel,
  credentialStatusTone, downloadCsv, formatDateTime, formatSeconds, kycLabel, orderStatusTone,
  relativeTime, secondsBetween, usd, usdCompact,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import {
  ArrowLeft, Award, BadgeCheck, Ban, Clock, Download, RotateCcw, Send, TrendingUp, User,
} from 'lucide-react';

interface Challenge {
  id: string;
  order_id: string | null;
  user_id: string | null;
  account_number: string | null;
  server: string | null;
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
  min_trading_days: number;
  trading_days: number;
  last_trade_date: string | null;
  total_trades: number;
  winning_trades: number;
  is_trial: boolean;
  trial_ends_at: string | null;
  credential_status: string | null;
  provisioned_at: string | null;
  credential_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Trade {
  id: string;
  symbol: string;
  type: string | null;
  lots: number | null;
  open_price: number | null;
  close_price: number | null;
  profit: number | null;
  open_time: string | null;
  close_time: string | null;
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
  paid_at: string | null;
}

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  kyc_status: string | null;
  telegram_username: string | null;
}

interface CredentialAuditEntry {
  id: string;
  action: string;
  acted_at: string;
  note: string | null;
}

interface NotificationEntry {
  id: string;
  type: string;
  status: string;
  subject: string;
  recipient_email: string;
  rule_violated: string | null;
  error_message: string | null;
  created_at: string;
}

/** Trades held under a minute are the risk engine's HFT signal. */
const HFT_SECONDS = 60;

export default function AdminChallengeDetailPage() {
  const params = useParams();
  const challengeId = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [snapshots, setSnapshots] = useState<{ date: string; equity: number }[]>([]);
  const [credentialAudit, setCredentialAudit] = useState<CredentialAuditEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!challengeId) return;
    setError(null);
    const supabase = createBrowserClient();

    const { data, error: challengeError } = await supabase
      .from('challenges')
      .select('id,order_id,user_id,account_number,server,status,starting_balance,current_equity,highest_equity,daily_peak_equity,daily_peak_date,phase_start_equity,profit_target,max_drawdown,daily_drawdown,min_trading_days,trading_days,last_trade_date,total_trades,winning_trades,is_trial,trial_ends_at,credential_status,provisioned_at,credential_sent_at,created_at,updated_at')
      .eq('id', challengeId)
      .maybeSingle();

    if (challengeError || !data) {
      setError(challengeError?.message ?? 'Challenge not found.');
      setLoading(false);
      return;
    }

    const row = data as unknown as Challenge;
    setChallenge(row);

    const [tradesRes, snapshotsRes, profileRes, orderRes, credRes, notifRes] = await Promise.all([
      supabase
        .from('trades')
        .select('id,symbol,type,lots,open_price,close_price,profit,open_time,close_time')
        .eq('challenge_id', challengeId)
        .order('close_time', { ascending: false })
        .limit(300),
      supabase
        .from('equity_snapshots')
        .select('snapshot_date,equity')
        .eq('challenge_id', challengeId)
        .order('snapshot_date', { ascending: true }),
      row.user_id
        ? supabase
            .from('profiles')
            .select('id,email,full_name,first_name,last_name,kyc_status,telegram_username')
            .eq('id', row.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      row.order_id
        ? supabase
            .from('orders')
            .select('id,payment_id,amount_usd,crypto_amount,crypto_currency,network,status,tx_hash,created_at,paid_at')
            .eq('id', row.order_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      fetch(`/api/admin/data?resource=credential_audit&challenge_id=${encodeURIComponent(challengeId)}&limit=20`, {
        cache: 'no-store',
      }),
      fetch(`/api/admin/data?resource=notifications&challenge_id=${encodeURIComponent(challengeId)}&limit=20`, {
        cache: 'no-store',
      }),
    ]);

    setTrades((tradesRes.data as Trade[] | null) ?? []);
    setProfile((profileRes.data as Profile | null) ?? null);
    setOrder((orderRes.data as Order | null) ?? null);

    type SnapshotRow = { snapshot_date: string; equity: number };
    const snapshotRows = (snapshotsRes.data as SnapshotRow[] | null) ?? [];
    setSnapshots(
      snapshotRows.map((s) => {
        const [y, m, d] = s.snapshot_date.split('-').map(Number);
        const label = y && m && d ? new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : s.snapshot_date;
        return { date: label, equity: s.equity };
      }),
    );

    if (credRes.ok) setCredentialAudit(((await credRes.json()) as { rows?: CredentialAuditEntry[] }).rows ?? []);
    if (notifRes.ok) setNotifications(((await notifRes.json()) as { rows?: NotificationEntry[] }).rows ?? []);

    setLoading(false);
  }, [challengeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const realised = trades.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
    const shortTrades = trades.filter((t) => {
      const held = secondsBetween(t.open_time, t.close_time);
      return held !== null && held < HFT_SECONDS;
    }).length;
    const wins = trades.filter((t) => (Number(t.profit) || 0) > 0).length;
    return {
      realised,
      shortTrades,
      shortShare: trades.length ? (shortTrades / trades.length) * 100 : 0,
      winRate: trades.length ? (wins / trades.length) * 100 : 0,
    };
  }, [trades]);

  async function runStatus(nextStatus: string, message: string) {
    if (!challenge) return { ok: false, error: 'no challenge' };
    const result = await adminAction('challenge_status', { challenge_id: challenge.id, status: nextStatus });
    if (!result.ok) return result;
    toast.success(message);
    setChallenge((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    return result;
  }

  async function sendCredentials() {
    if (!challenge) return { ok: false, error: 'no challenge' };
    const result = await adminAction('credentials_send', { challenge_id: challenge.id });
    if (!result.ok) return result;
    toast.success('Credentials delivered to the trader');
    setChallenge((prev) => (prev ? { ...prev, credential_status: 'sent' } : prev));
    return result;
  }

  async function issueCertificate() {
    if (!challenge) return { ok: false, error: 'no challenge' };
    const result = await adminAction('certificate_issue', { challenge_id: challenge.id });
    if (!result.ok) return result;
    toast.success('Certificate issued');
    return result;
  }

  function exportTrades() {
    downloadCsv(`trivaro-trades-${challenge?.account_number ?? challengeId.slice(0, 8)}.csv`, [
      ['Closed', 'Symbol', 'Type', 'Lots', 'Open', 'Close', 'Held (s)', 'Profit'],
      ...trades.map((t) => [
        t.close_time,
        t.symbol,
        t.type,
        t.lots,
        t.open_price,
        t.close_price,
        secondsBetween(t.open_time, t.close_time) ?? '',
        Number(t.profit ?? 0).toFixed(2),
      ]),
    ]);
  }

  const tradeColumns: AdminColumn<Trade>[] = [
    {
      key: 'symbol',
      header: 'Symbol',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{row.symbol}</span>
          <StatusPill tone={row.type === 'buy' ? 'success' : 'danger'}>{row.type?.toUpperCase() ?? '—'}</StatusPill>
          {(secondsBetween(row.open_time, row.close_time) ?? 999) < HFT_SECONDS && (
            <StatusPill tone="warn">HFT</StatusPill>
          )}
        </div>
      ),
      cell: (row) => {
        const held = secondsBetween(row.open_time, row.close_time);
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">{row.symbol}</span>
            <StatusPill tone={row.type === 'buy' ? 'success' : 'danger'}>{row.type?.toUpperCase() ?? '—'}</StatusPill>
            {held !== null && held < HFT_SECONDS && <StatusPill tone="warn">under 1m</StatusPill>}
          </div>
        );
      },
    },
    { key: 'lots', header: 'Lots', numeric: true, cell: (row) => row.lots ?? '—' },
    {
      key: 'prices',
      header: 'Open → close',
      desktopOnly: true,
      cell: (row) => (
        <span className="text-xs text-text-secondary">
          {row.open_price ?? '—'} → {row.close_price ?? '—'}
        </span>
      ),
    },
    {
      key: 'held',
      header: 'Held',
      cell: (row) => (
        <span className="text-xs text-text-muted">{formatSeconds(secondsBetween(row.open_time, row.close_time))}</span>
      ),
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

  if (loading) return <p className="py-16 text-center text-sm text-text-muted">Loading account…</p>;

  if (error || !challenge) {
    return (
      <div className="space-y-4">
        <Link href="/admin/challenges" className={adminButtonClass('secondary')}>
          <ArrowLeft className="h-3.5 w-3.5" />
          All challenges
        </Link>
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error ?? 'Challenge not found.'}
        </div>
      </div>
    );
  }

  const health = challengeHealth(challenge);
  const traderName =
    profile?.full_name?.trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    profile?.email ||
    'Unknown trader';

  const isLive = ['trial', 'active', 'phase1_complete', 'phase2_complete'].includes(challenge.status);
  const certifiable = !challenge.is_trial && ['funded', 'passed', 'phase2_complete'].includes(challenge.status);

  return (
    <div className="space-y-5">
      <Link href="/admin/challenges" className={adminButtonClass('ghost', 'sm')}>
        <ArrowLeft className="h-3.5 w-3.5" />
        All challenges
      </Link>

      <header className="rounded-xl border border-amber-500/10 bg-navy-700/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-bold">{challenge.account_number ?? challenge.id.slice(0, 8)}</h1>
              <StatusPill tone={challengeStatusTone(challenge.status)}>{challengeStatusLabel(challenge.status)}</StatusPill>
              {challenge.is_trial && <StatusPill tone="warn">trial</StatusPill>}
              <StatusPill tone={health.health === 'breach' ? 'danger' : health.health === 'watch' ? 'warn' : 'success'}>
                risk: {health.health}
              </StatusPill>
              <StatusPill tone={credentialStatusTone(challenge.credential_status)}>
                {credentialStatusLabel(challenge.credential_status)}
              </StatusPill>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              {challenge.user_id ? (
                <Link href={`/admin/traders/${challenge.user_id}`} className="inline-flex items-center gap-1 hover:text-amber-300">
                  <User className="h-3.5 w-3.5" />
                  {traderName}
                </Link>
              ) : (
                <span>No trader linked</span>
              )}
              <span>{usdCompact(challenge.starting_balance)} account</span>
              <span>opened {relativeTime(challenge.created_at)}</span>
              {challenge.server && <span>server {challenge.server}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(!challenge.credential_status || challenge.credential_status === 'none') && (
              <AsyncButton
                variant="primary"
                icon={BadgeCheck}
                title="Authorise this account and queue it for MT5 provisioning"
                onRun={async () => {
                  const result = await adminAction('challenge_authorize', { challenge_id: challenge.id });
                  if (!result.ok) return result;
                  toast.success('Account authorised');
                  setChallenge((prev) => (prev ? { ...prev, credential_status: 'pending' } : prev));
                  return result;
                }}
              >
                Authorise
              </AsyncButton>
            )}
            {challenge.credential_status === 'provisioned' && (
              <AsyncButton variant="success" icon={Send} title="Send the MT5 login to the trader on Telegram" onRun={sendCredentials}>
                Deliver credentials
              </AsyncButton>
            )}
            {challenge.is_trial && (
              <AsyncButton
                variant="secondary"
                icon={Clock}
                title="Give this trial another 7 days"
                onRun={async () => {
                  const result = await adminAction('challenge_extend_trial', { challenge_id: challenge.id, days: 7 });
                  if (!result.ok) return result;
                  toast.success('Trial extended by 7 days');
                  setChallenge((prev) =>
                    prev ? { ...prev, trial_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString() } : prev,
                  );
                  return result;
                }}
              >
                +7 days
              </AsyncButton>
            )}
            {isLive && challenge.status !== 'funded' && (
              <ConfirmActionButton
                label="Mark funded"
                confirmLabel="Confirm funded"
                variant="success"
                icon={Award}
                title="Promote this account to a funded account"
                onRun={() => runStatus('funded', 'Account marked funded')}
              />
            )}
            {isLive && (
              <ConfirmActionButton
                label="Mark failed"
                confirmLabel="Confirm failure"
                variant="danger"
                icon={Ban}
                title="Fail this account (rule breach)"
                onRun={() => runStatus('failed', 'Account marked failed')}
              />
            )}
            {!isLive && challenge.status !== 'failed' && !challenge.is_trial && (
              <ConfirmActionButton
                label="Reopen (Phase 1)"
                confirmLabel="Confirm reopen"
                variant="secondary"
                icon={RotateCcw}
                title="Return this account to Phase 1"
                onRun={() => runStatus('active', 'Account reopened in Phase 1')}
              />
            )}
            {certifiable && (
              <AsyncButton variant="secondary" icon={Award} title="Issue a completion certificate" onRun={issueCertificate}>
                Certificate
              </AsyncButton>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Equity"
          value={challenge.current_equity != null ? usdCompact(challenge.current_equity) : '—'}
          hint={`from ${usdCompact(challenge.starting_balance)}`}
          icon={TrendingUp}
          tone={health.profitPct >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="Profit progress"
          value={`${health.profitPct >= 0 ? '+' : ''}${health.profitPct.toFixed(2)}%`}
          hint={`target ${challenge.profit_target}% · ${Math.round(health.targetPct)}% reached`}
          tone={health.targetPct >= 100 ? 'success' : 'info'}
        />
        <StatCard
          label="Loss allowance used"
          value={`${Math.round(health.totalLossUsedPct)}%`}
          hint={`${health.totalDrawdownPct.toFixed(2)}% of a ${challenge.max_drawdown}% limit`}
          tone={health.totalLossUsedPct >= 75 ? 'danger' : health.totalLossUsedPct >= 50 ? 'warn' : 'success'}
        />
        <StatCard
          label="Trading days"
          value={`${challenge.trading_days} / ${challenge.min_trading_days}`}
          hint={challenge.last_trade_date ? `last trade ${relativeTime(challenge.last_trade_date)}` : 'no trades yet'}
          tone={health.daysPct >= 100 ? 'success' : 'neutral'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Rule compliance" description="Live values straight from the risk engine.">
          <div className="space-y-4">
            <ProgressBar
              label="Profit target"
              caption={`${health.profitPct.toFixed(2)}% of ${challenge.profit_target}%`}
              value={health.targetPct}
              tone={health.targetPct >= 100 ? 'success' : 'info'}
            />
            <ProgressBar
              label="Maximum total loss"
              caption={`${health.totalDrawdownPct.toFixed(2)}% of ${challenge.max_drawdown}%`}
              value={health.totalLossUsedPct}
              tone={health.totalLossUsedPct >= 75 ? 'danger' : health.totalLossUsedPct >= 50 ? 'warn' : 'success'}
            />
            <ProgressBar
              label="Daily loss (today)"
              caption={
                health.dailyLossUsedPct === null
                  ? 'no trades today'
                  : `${health.dailyLossUsedPct.toFixed(0)}% of today's ${challenge.daily_drawdown}% allowance`
              }
              value={health.dailyLossUsedPct ?? 0}
              tone={(health.dailyLossUsedPct ?? 0) >= 75 ? 'danger' : 'success'}
            />
            <ProgressBar
              label="Minimum trading days"
              caption={`${challenge.trading_days} of ${challenge.min_trading_days}`}
              value={health.daysPct}
              tone={health.daysPct >= 100 ? 'success' : 'info'}
            />
            <div className="rounded-lg bg-navy-800/60 p-3 text-[11px] text-text-muted">
              Conduct signals from the trade log: {stats.shortTrades} of {trades.length} trades held under a minute
              ({stats.shortShare.toFixed(0)}%). The rules treat a majority under one minute as high-frequency trading.
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Equity history" description="Daily snapshots written by the MT5 bridge.">
          {snapshots.length === 0 ? (
            <p className="py-12 text-center text-xs text-text-muted">
              No equity snapshots yet — the bridge writes one per trading day.
            </p>
          ) : (
            <EquityChart data={snapshots} />
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={`Trades (${trades.length})`}
        description={`${usd.format(stats.realised)} realised across the trades loaded · ${stats.winRate.toFixed(0)}% win rate`}
        actions={
          <button type="button" className={adminButtonClass('secondary', 'sm')} onClick={exportTrades} disabled={!trades.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        }
      >
        <AdminTable
          rows={trades}
          columns={tradeColumns}
          getRowKey={(row) => row.id}
          empty={<p className="py-6 text-center text-xs text-text-muted">No trades have arrived from the bridge yet.</p>}
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Payment" description="The order that funded this account.">
          {!order ? (
            <p className="py-4 text-center text-xs text-text-muted">
              {challenge.is_trial ? 'Free trial — no payment required.' : 'No order linked to this account.'}
            </p>
          ) : (
            <div className="space-y-3">
              <DefinitionList
                items={[
                  { label: 'Payment id', value: <code className="text-xs">{order.payment_id}</code> },
                  { label: 'Amount', value: `${usd.format(Number(order.amount_usd) || 0)} in ${order.crypto_currency ?? 'USDT'}` },
                  { label: 'Network', value: order.network ?? '—' },
                  { label: 'Created', value: formatDateTime(order.created_at) },
                  { label: 'Paid', value: order.paid_at ? formatDateTime(order.paid_at) : '—' },
                  { label: 'Tx hash', value: order.tx_hash ? <code className="text-[11px]">{order.tx_hash}</code> : '—' },
                ]}
              />
              <StatusPill tone={orderStatusTone(order.status)}>{order.status}</StatusPill>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Credential history" description="Every provisioning action is audit-logged.">
          {credentialAudit.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">No credential actions recorded.</p>
          ) : (
            <ul className="divide-y divide-amber-500/5">
              {credentialAudit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <StatusPill tone="info">{entry.action}</StatusPill>
                    {entry.note && <p className="mt-1 truncate text-[11px] text-text-muted">{entry.note}</p>}
                  </div>
                  <span className="text-[11px] text-text-muted">{relativeTime(entry.acted_at)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 grid gap-1 text-[11px] text-text-muted">
            <span>Provisioned: {challenge.provisioned_at ? formatDateTime(challenge.provisioned_at) : '—'}</span>
            <span>Delivered: {challenge.credential_sent_at ? formatDateTime(challenge.credential_sent_at) : '—'}</span>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Notifications" description="Rule emails queued for this account.">
        {notifications.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-muted">Nothing sent to this trader yet.</p>
        ) : (
          <ul className="divide-y divide-amber-500/5">
            {notifications.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs">{entry.subject}</p>
                  <p className="text-[11px] text-text-muted">
                    {entry.type.replace(/_/g, ' ')} → {entry.recipient_email}
                    {entry.rule_violated ? ` · rule: ${entry.rule_violated}` : ''}
                  </p>
                  {entry.error_message && <p className="text-[11px] text-red-400">{entry.error_message}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={entry.status === 'sent' ? 'success' : entry.status === 'failed' ? 'danger' : 'warn'}>
                    {entry.status}
                  </StatusPill>
                  <span className="text-[11px] text-text-muted">{relativeTime(entry.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Account record" description="Raw values from the database.">
        <DefinitionList
          items={[
            { label: 'Challenge id', value: <code className="text-xs">{challenge.id}</code> },
            { label: 'Trader id', value: <code className="text-xs">{challenge.user_id ?? '—'}</code> },
            { label: 'KYC', value: kycLabel(profile?.kyc_status ?? null) },
            { label: 'Telegram', value: profile?.telegram_username ? `@${profile.telegram_username.replace(/^@/, '')}` : '—' },
            { label: 'Peak equity', value: challenge.highest_equity != null ? usd.format(challenge.highest_equity) : '—' },
            { label: 'Trial ends', value: challenge.trial_ends_at ? formatDateTime(challenge.trial_ends_at) : '—' },
            { label: 'Updated', value: formatDateTime(challenge.updated_at) },
            { label: 'Total trades', value: `${challenge.total_trades} (${challenge.winning_trades} winners)` },
          ]}
        />
      </SectionCard>
    </div>
  );
}
