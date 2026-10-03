'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Database } from '@/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface TradeHistoryProps {
  trades: Trade[];
  loading?: boolean;
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

/** Trade timestamps are full ISO-8601 instants, so this is a real local-time
 *  conversion (unlike `snapshot_date`, which is a bare date). */
function formatTradeDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
}

export function TradeHistory({ trades, loading }: TradeHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-busy="true">
        <span className="sr-only">Loading trades…</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (!trades.length) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-teal-500/10">
        <p className="text-sm text-text-muted">No trades recorded yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Card list on phones — a 5-column table inside a 320px card is
          unreadable, and `w-full` tables never trigger the overflow wrapper. */}
      <ul className="space-y-3 sm:hidden">
        {trades.map((trade) => (
          <li key={trade.id} className="rounded-xl border border-teal-500/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{trade.symbol}</span>
              <Badge variant={trade.type === 'buy' ? 'success' : 'destructive'}>
                {trade.type?.toUpperCase() ?? '—'}
              </Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="text-text-muted">
                {trade.lots ?? '—'} lots · {formatTradeDate(trade.close_time)}
              </span>
              <span
                className={`font-mono ${
                  (Number(trade.profit) || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {usd.format(Number(trade.profit) || 0)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-teal-500/10 text-left text-text-muted">
              <th className="whitespace-nowrap pb-3 pr-4 font-medium">Symbol</th>
              <th className="whitespace-nowrap pb-3 pr-4 font-medium">Type</th>
              <th className="whitespace-nowrap pb-3 pr-4 font-medium">Lots</th>
              <th className="whitespace-nowrap pb-3 pr-4 font-medium">Profit</th>
              <th className="whitespace-nowrap pb-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-b border-teal-500/5">
                <td className="whitespace-nowrap py-3 pr-4 font-medium">{trade.symbol}</td>
                <td className="py-3 pr-4">
                  <Badge variant={trade.type === 'buy' ? 'success' : 'destructive'}>
                    {trade.type?.toUpperCase() ?? '—'}
                  </Badge>
                </td>
                <td className="py-3 pr-4">{trade.lots ?? '—'}</td>
                <td
                  className={`py-3 pr-4 font-mono ${
                    (Number(trade.profit) || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {usd.format(Number(trade.profit) || 0)}
                </td>
                <td className="whitespace-nowrap py-3 text-text-secondary">
                  {formatTradeDate(trade.close_time)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
