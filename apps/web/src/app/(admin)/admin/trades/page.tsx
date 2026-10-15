'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, Pagination, type AdminColumn } from '@/components/admin/Table';
import { FilterChips, SectionCard, StatCard, StatusPill } from '@/components/admin/Primitives';
import { adminButtonClass } from '@/components/admin/Actions';
import {
  downloadCsv, formatDateTime, formatSeconds, secondsBetween, usd, usdCompact,
} from '@/lib/admin';
import { Download, LineChart, RefreshCw, Search, TriangleAlert } from 'lucide-react';

interface Trade {
  id: string;
  challenge_id: string;
  symbol: string;
  type: string | null;
  lots: number | null;
  open_price: number | null;
  close_price: number | null;
  profit: number | null;
  open_time: string | null;
  close_time: string | null;
}

interface ChallengeRef {
  id: string;
  account_number: string | null;
  user_id: string | null;
  status: string;
  is_trial: boolean;
}

const WINDOWS = ['7', '30', '90', 'all'] as const;
const RESULTS = ['all', 'wins', 'losses'] as const;
const PAGE_SIZE = 30;

type Period = (typeof WINDOWS)[number];
type Result = (typeof RESULTS)[number];

const HFT_SECONDS = 60;

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [challenges, setChallenges] = useState<Record<string, ChallengeRef>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Named `period`, not `window` — shadowing the global would silently break
  // any DOM access in this component.
  const [period, setPeriod] = useState<Period>('30');
  const [result, setResult] = useState<Result>('all');
  const [shortOnly, setShortOnly] = useState(false);
  const [page, setPage] = useState(0);
  /** Reference "now" for the period filter, captured when the data loads.
   *  Reading Date.now() during render would be impure (unstable across
   *  re-renders); pinning it per load also makes the filter reproducible. */
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();

    const { data, error: queryError } = await supabase
      .from('trades')
      .select('id,challenge_id,symbol,type,lots,open_price,close_price,profit,open_time,close_time')
      .order('close_time', { ascending: false })
      .limit(1000);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data as Trade[] | null) ?? [];
    setTrades(rows);
    setLoadedAt(Date.now());

    const challengeIds = Array.from(new Set(rows.map((t) => t.challenge_id)));
    if (challengeIds.length) {
      const { data: challengeData } = await supabase
        .from('challenges')
        .select('id,account_number,user_id,status,is_trial')
        .in('id', challengeIds);
      const map: Record<string, ChallengeRef> = {};
      for (const row of (challengeData as ChallengeRef[] | null) ?? []) map[row.id] = row;
      setChallenges(map);

      const userIds = Array.from(new Set(Object.values(map).map((c) => c.user_id).filter(Boolean))) as string[];
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id,email,full_name').in('id', userIds);
        const emailMap: Record<string, string> = {};
        for (const profile of (profiles ?? []) as { id: string; email: string | null; full_name: string | null }[]) {
          emailMap[profile.id] = profile.email ?? profile.full_name ?? profile.id.slice(0, 8);
        }
        setEmails(emailMap);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = period === 'all' || loadedAt === null ? null : loadedAt - Number(period) * 86_400_000;

    return trades.filter((trade) => {
      if (cutoff !== null) {
        const when = Date.parse(trade.close_time ?? '');
        if (!Number.isFinite(when) || when < cutoff) return false;
      }
      if (result === 'wins' && (Number(trade.profit) || 0) <= 0) return false;
      if (result === 'losses' && (Number(trade.profit) || 0) >= 0) return false;
      if (shortOnly) {
        const held = secondsBetween(trade.open_time, trade.close_time);
        if (held === null || held >= HFT_SECONDS) return false;
      }
      if (!needle) return true;
      const challenge = challenges[trade.challenge_id];
      return (
        trade.symbol.toLowerCase().includes(needle) ||
        (challenge?.account_number ?? '').toLowerCase().includes(needle) ||
        (emails[challenge?.user_id ?? ''] ?? '').toLowerCase().includes(needle)
      );
    });
  }, [trades, challenges, emails, query, period, result, shortOnly, loadedAt]);

  const totals = useMemo(() => {
    const net = filtered.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
    const wins = filtered.filter((t) => (Number(t.profit) || 0) > 0).length;
    const shorts = filtered.filter((t) => {
      const held = secondsBetween(t.open_time, t.close_time);
      return held !== null && held < HFT_SECONDS;
    }).length;
    const symbols = new Map<string, number>();
    for (const trade of filtered) symbols.set(trade.symbol, (symbols.get(trade.symbol) ?? 0) + 1);
    const topSymbol = [...symbols.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      net,
      winRate: filtered.length ? (wins / filtered.length) * 100 : 0,
      shorts,
      shortShare: filtered.length ? (shorts / filtered.length) * 100 : 0,
      topSymbol: topSymbol ? `${topSymbol[0]} (${topSymbol[1]})` : '—',
    };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const columns: AdminColumn<Trade>[] = [
    {
      key: 'symbol',
      header: 'Instrument',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{row.symbol}</span>
          <StatusPill tone={row.type === 'buy' ? 'success' : 'danger'}>{row.type?.toUpperCase() ?? '—'}</StatusPill>
          {(secondsBetween(row.open_time, row.close_time) ?? 999) < HFT_SECONDS && <StatusPill tone="warn">HFT</StatusPill>}
        </div>
      ),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{row.symbol}</span>
          <StatusPill tone={row.type === 'buy' ? 'success' : 'danger'}>{row.type?.toUpperCase() ?? '—'}</StatusPill>
          {(secondsBetween(row.open_time, row.close_time) ?? 999) < HFT_SECONDS && <StatusPill tone="warn">under 1m</StatusPill>}
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Account',
      cell: (row) => {
        const challenge = challenges[row.challenge_id];
        if (!challenge) return <span className="text-xs text-text-muted">—</span>;
        return (
          <div className="min-w-0">
            <Link href={`/admin/challenges/${challenge.id}`} className="font-mono text-xs hover:text-amber-300">
              {challenge.account_number ?? challenge.id.slice(0, 8)}
            </Link>
            <p className="truncate text-[11px] text-text-muted">
              {emails[challenge.user_id ?? ''] ?? 'unknown trader'}
              {challenge.is_trial ? ' · trial' : ''}
            </p>
          </div>
        );
      },
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

  function exportCsv() {
    downloadCsv('trivaro-trades.csv', [
      ['Closed', 'Account', 'Trader', 'Symbol', 'Type', 'Lots', 'Open', 'Close', 'Held (s)', 'Profit'],
      ...filtered.map((trade) => {
        const challenge = challenges[trade.challenge_id];
        return [
          trade.close_time,
          challenge?.account_number ?? trade.challenge_id,
          emails[challenge?.user_id ?? ''] ?? '',
          trade.symbol,
          trade.type,
          trade.lots,
          trade.open_price,
          trade.close_price,
          secondsBetween(trade.open_time, trade.close_time) ?? '',
          Number(trade.profit ?? 0).toFixed(2),
        ];
      }),
    ]);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Trades</h1>
          <p className="text-sm text-text-muted">
            Every closed trade the MT5 bridge has received — filter by account, result or holding time.
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
          Could not load trades: {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trades in view" value={filtered.length} hint={`of ${trades.length} loaded`} icon={LineChart} tone="info" />
        <StatCard
          label="Net P/L"
          value={usdCompact(totals.net)}
          hint="Sum of profits in the current filter"
          tone={totals.net >= 0 ? 'success' : 'danger'}
        />
        <StatCard label="Win rate" value={`${totals.winRate.toFixed(0)}%`} hint="Closed trades in profit" tone="neutral" />
        <StatCard
          label="Under 1 minute"
          value={`${totals.shortShare.toFixed(0)}%`}
          hint={`${totals.shorts} trades · HFT review signal`}
          icon={TriangleAlert}
          tone={totals.shortShare > 50 ? 'danger' : totals.shortShare > 25 ? 'warn' : 'success'}
        />
      </div>

      <SectionCard title="Filters" description={`Most traded instrument: ${totals.topSymbol}`}>
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
                placeholder="Search symbol, account or trader…"
                aria-label="Search trades"
                className="w-full rounded-lg border border-amber-500/10 bg-navy-800 py-2 pl-9 pr-3 text-sm placeholder:text-text-muted focus:border-amber-400/40 focus:outline-none"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={shortOnly}
                onChange={(e) => {
                  setShortOnly(e.target.checked);
                  setPage(0);
                }}
                className="h-4 w-4 rounded border-amber-500/30 bg-navy-800"
              />
              Under a minute only
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <FilterChips
              ariaLabel="Filter by period"
              options={WINDOWS}
              value={period}
              onChange={(next) => {
                setPeriod(next);
                setPage(0);
              }}
              labels={{ '7': '7 days', '30': '30 days', '90': '90 days', all: 'All time' }}
            />
            <FilterChips
              ariaLabel="Filter by result"
              options={RESULTS}
              value={result}
              onChange={(next) => {
                setResult(next);
                setPage(0);
              }}
              labels={{ all: 'All results', wins: 'Winners', losses: 'Losers' }}
            />
          </div>
        </div>
      </SectionCard>

      <AdminTable
        rows={paged}
        columns={columns}
        getRowKey={(row) => row.id}
        loading={loading}
        empty={<p className="py-8 text-center text-sm text-text-muted">No trades match these filters.</p>}
        footer={<Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />}
      />
    </div>
  );
}
