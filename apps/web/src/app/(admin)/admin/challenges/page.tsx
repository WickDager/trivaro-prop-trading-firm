'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, Pagination, type AdminColumn } from '@/components/admin/Table';
import { FilterChips, ProgressBar, SectionCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, adminButtonClass } from '@/components/admin/Actions';
import {
  adminAction, challengeHealth, challengeStatusLabel, challengeStatusTone, credentialStatusLabel,
  credentialStatusTone, downloadCsv, formatDate, relativeTime, usd, usdCompact,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import { BadgeCheck, Download, Eye, RefreshCw, Search, TriangleAlert } from 'lucide-react';

interface ChallengeRow {
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
  user_id: string | null;
  created_at: string;
}

const STATUS_FILTERS = [
  'all',
  'trial',
  'trial_expired',
  'active',
  'phase1_complete',
  'phase2_complete',
  'funded',
  'failed',
] as const;
const CRED_FILTERS = ['all', 'none', 'pending', 'provisioned', 'sent'] as const;
const SORTS = ['risk', 'recent', 'equity', 'profit'] as const;
const SORT_LABELS: Record<(typeof SORTS)[number], string> = {
  risk: 'Risk first',
  recent: 'Newest',
  equity: 'Equity',
  profit: 'Profit %',
};
const PAGE_SIZE = 25;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type CredFilter = (typeof CRED_FILTERS)[number];
type Sort = (typeof SORTS)[number];

function ChallengesInner() {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<ChallengeRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>(() => {
    const param = searchParams.get('status');
    return (STATUS_FILTERS as readonly string[]).includes(param ?? '') ? (param as StatusFilter) : 'all';
  });
  const [creds, setCreds] = useState<CredFilter>('all');
  const [riskOnly, setRiskOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('risk');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();
    const { data, error: queryError } = await supabase
      .from('challenges')
      .select('id,account_number,status,starting_balance,current_equity,highest_equity,daily_peak_equity,daily_peak_date,phase_start_equity,profit_target,max_drawdown,daily_drawdown,trading_days,min_trading_days,last_trade_date,total_trades,winning_trades,is_trial,credential_status,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rowsData = (data as ChallengeRow[] | null) ?? [];
    setRows(rowsData);

    const userIds = Array.from(new Set(rowsData.map((r) => r.user_id).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,email,full_name').in('id', userIds);
      const map: Record<string, string> = {};
      for (const profile of (profiles ?? []) as { id: string; email: string | null; full_name: string | null }[]) {
        map[profile.id] = profile.email ?? profile.full_name ?? profile.id.slice(0, 8);
      }
      setEmails(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (status !== 'all' && row.status !== status) return false;
      if (creds === 'none' && row.credential_status && row.credential_status !== 'none') return false;
      if (creds === 'pending' && row.credential_status !== 'pending') return false;
      if (creds === 'provisioned' && row.credential_status !== 'provisioned') return false;
      if (creds === 'sent' && row.credential_status !== 'sent') return false;
      if (riskOnly && challengeHealth(row).health === 'ok') return false;
      if (!needle) return true;
      return (
        (row.account_number ?? '').toLowerCase().includes(needle) ||
        (emails[row.user_id ?? ''] ?? '').toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle)
      );
    });

    return list.sort((a, b) => {
      if (sort === 'risk') {
        const rank = { breach: 0, watch: 1, ok: 2 } as const;
        const diff = rank[challengeHealth(a).health] - rank[challengeHealth(b).health];
        if (diff !== 0) return diff;
      }
      if (sort === 'equity') return (Number(b.current_equity) || 0) - (Number(a.current_equity) || 0);
      if (sort === 'profit') return challengeHealth(b).profitPct - challengeHealth(a).profitPct;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [rows, status, creds, riskOnly, query, sort, emails]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const atRisk = rows.filter((row) => challengeHealth(row).health !== 'ok').length;

  async function authorise(challengeId: string) {
    const result = await adminAction('challenge_authorize', { challenge_id: challengeId });
    if (!result.ok) return result;
    toast.success('Account authorised — queued for provisioning');
    setRows((prev) =>
      prev.map((row) => (row.id === challengeId ? { ...row, credential_status: 'pending' } : row)),
    );
    return result;
  }

  const columns: AdminColumn<ChallengeRow>[] = [
    {
      key: 'account',
      header: 'Account',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/challenges/${row.id}`} className="font-mono text-xs hover:text-amber-300">
            {row.account_number ?? row.id.slice(0, 8)}
          </Link>
          <StatusPill tone={challengeStatusTone(row.status)}>{challengeStatusLabel(row.status)}</StatusPill>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/challenges/${row.id}`} className="font-mono text-xs hover:text-amber-300">
            {row.account_number ?? row.id.slice(0, 8)}
          </Link>
          <p className="text-[11px] text-text-muted">{row.is_trial ? 'Free trial' : usdCompact(row.starting_balance)}</p>
        </div>
      ),
    },
    {
      key: 'trader',
      header: 'Trader',
      cell: (row) => (
        <Link href={`/admin/traders/${row.user_id}`} className="block max-w-[14rem] truncate text-xs hover:text-amber-300">
          {emails[row.user_id ?? ''] ?? 'Unknown'}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Phase',
      cell: (row) => <StatusPill tone={challengeStatusTone(row.status)}>{challengeStatusLabel(row.status)}</StatusPill>,
    },
    {
      key: 'equity',
      header: 'Equity',
      numeric: true,
      cell: (row) => {
        const health = challengeHealth(row);
        return (
          <div className="min-w-[7rem]">
            <p>{row.current_equity != null ? usd.format(row.current_equity) : '—'}</p>
            <p className={health.profitPct >= 0 ? 'text-[11px] text-green-400' : 'text-[11px] text-red-400'}>
              {health.profitPct >= 0 ? '+' : ''}
              {health.profitPct.toFixed(1)}%
            </p>
          </div>
        );
      },
    },
    {
      key: 'target',
      header: 'Target / Loss',
      cell: (row) => {
        const health = challengeHealth(row);
        return (
          <div className="min-w-[9rem] space-y-1.5">
            <ProgressBar
              label="Target"
              caption={`${Math.round(health.targetPct)}%`}
              value={health.targetPct}
              tone={health.targetPct >= 100 ? 'success' : 'info'}
            />
            <ProgressBar
              label="Max loss used"
              caption={`${Math.round(health.totalLossUsedPct)}%`}
              value={health.totalLossUsedPct}
              tone={health.totalLossUsedPct >= 75 ? 'danger' : health.totalLossUsedPct >= 50 ? 'warn' : 'success'}
            />
          </div>
        );
      },
    },
    {
      key: 'days',
      header: 'Days',
      numeric: true,
      cell: (row) => (
        <span>
          {row.trading_days}
          <span className="text-text-muted"> / {row.min_trading_days}</span>
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
      key: 'activity',
      header: 'Last trade',
      cell: (row) => <span className="text-xs text-text-muted">{row.last_trade_date ? relativeTime(row.last_trade_date) : 'never'}</span>,
    },
    {
      key: 'creds',
      header: 'Credentials',
      cell: (row) => (
        <StatusPill tone={credentialStatusTone(row.credential_status)}>
          {credentialStatusLabel(row.credential_status)}
        </StatusPill>
      ),
    },
    {
      key: 'risk',
      header: 'Risk',
      cell: (row) => {
        const health = challengeHealth(row);
        return (
          <StatusPill tone={health.health === 'breach' ? 'danger' : health.health === 'watch' ? 'warn' : 'success'}>
            {health.health}
          </StatusPill>
        );
      },
    },
  ];

  function exportCsv() {
    downloadCsv('trivaro-challenges.csv', [
      [
        'Account', 'Trader', 'Status', 'Trial', 'Starting balance', 'Equity', 'Profit %', 'Target %',
        'Max loss used %', 'Trading days', 'Trades', 'Winning', 'Last trade', 'Credentials', 'Risk', 'Created',
      ],
      ...filtered.map((row) => {
        const health = challengeHealth(row);
        return [
          row.account_number ?? row.id,
          emails[row.user_id ?? ''] ?? '',
          row.status,
          row.is_trial ? 'yes' : 'no',
          Number(row.starting_balance).toFixed(2),
          row.current_equity != null ? Number(row.current_equity).toFixed(2) : '',
          health.profitPct.toFixed(2),
          health.targetPct.toFixed(1),
          health.totalLossUsedPct.toFixed(1),
          row.trading_days,
          row.total_trades,
          row.winning_trades,
          row.last_trade_date ?? '',
          row.credential_status ?? '',
          health.health,
          row.created_at,
        ];
      }),
    ]);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Challenges</h1>
          <p className="text-sm text-text-muted">
            {rows.length} accounts · {atRisk} need a closer look ·{' '}
            {rows.filter((r) => ['active', 'trial', 'phase1_complete', 'phase2_complete'].includes(r.status)).length} live
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={adminButtonClass('secondary')} onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            className={adminButtonClass('secondary')}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not load challenges: {error}
        </div>
      )}

      <SectionCard title="Filters" description="Narrow by phase, provisioning stage or risk.">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-sm sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search account number or trader…"
                aria-label="Search challenges"
                className="w-full rounded-lg border border-amber-500/10 bg-navy-800 py-2 pl-9 pr-3 text-sm placeholder:text-text-muted focus:border-amber-400/40 focus:outline-none"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={riskOnly}
                onChange={(e) => {
                  setRiskOnly(e.target.checked);
                  setPage(0);
                }}
                className="h-4 w-4 rounded border-amber-500/30 bg-navy-800"
              />
              <TriangleAlert className="h-3.5 w-3.5 text-amber-400" />
              At risk only
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-lg border border-amber-500/10 bg-navy-800 px-2 py-1.5 text-xs"
              >
                {SORTS.map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <FilterChips
              ariaLabel="Filter by status"
              options={STATUS_FILTERS}
              value={status}
              onChange={(next) => {
                setStatus(next);
                setPage(0);
              }}
              labels={{ all: 'All phases' }}
            />
            <FilterChips
              ariaLabel="Filter by credential status"
              options={CRED_FILTERS}
              value={creds}
              onChange={(next) => {
                setCreds(next);
                setPage(0);
              }}
              labels={{ all: 'Any credentials', none: 'Not queued', pending: 'Awaiting MT5', provisioned: 'Ready to send', sent: 'Delivered' }}
            />
          </div>
        </div>
      </SectionCard>

      <AdminTable
        rows={paged}
        columns={columns}
        getRowKey={(row) => row.id}
        loading={loading}
        rowTone={(row) => {
          const health = challengeHealth(row).health;
          if (health === 'breach') return 'bg-red-500/[0.04]';
          if (health === 'watch') return 'bg-amber-500/[0.03]';
          return undefined;
        }}
        actions={(row) => (
          <>
            {(!row.credential_status || row.credential_status === 'none') && (
              <AsyncButton
                variant="primary"
                icon={BadgeCheck}
                title="Authorise this account and queue it for MT5 provisioning"
                onRun={() => authorise(row.id)}
              >
                Authorise
              </AsyncButton>
            )}
            <Link href={`/admin/challenges/${row.id}`} className={adminButtonClass('ghost', 'sm')}>
              <Eye className="h-3.5 w-3.5" />
              Monitor
            </Link>
          </>
        )}
        empty={<p className="py-8 text-center text-sm text-text-muted">No challenges match these filters.</p>}
        footer={<Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />}
      />

      <p className="text-[11px] text-text-muted">
        Showing {filtered.length} of {rows.length} accounts loaded · oldest loaded account created{' '}
        {rows.length ? formatDate(rows[rows.length - 1].created_at) : '—'}
      </p>
    </div>
  );
}

export default function AdminChallengesPage() {
  // `useSearchParams` (for ?status=failed deep links) must sit inside a Suspense
  // boundary so the route can still be prerendered at build time.
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-text-muted">Loading challenges…</p>}>
      <ChallengesInner />
    </Suspense>
  );
}
