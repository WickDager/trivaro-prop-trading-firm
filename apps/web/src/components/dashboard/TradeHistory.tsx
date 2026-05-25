'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Database } from '@/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface TradeHistoryProps {
  trades: Trade[];
  loading?: boolean;
}

export function TradeHistory({ trades, loading }: TradeHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-teal-500/10 text-left text-text-muted">
            <th className="pb-3 pr-4 font-medium">Symbol</th>
            <th className="pb-3 pr-4 font-medium">Type</th>
            <th className="pb-3 pr-4 font-medium">Lots</th>
            <th className="pb-3 pr-4 font-medium">Profit</th>
            <th className="pb-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-teal-500/5">
              <td className="py-3 pr-4 font-medium">{trade.symbol}</td>
              <td className="py-3 pr-4">
                <Badge variant={trade.type === 'buy' ? 'success' : 'destructive'}>
                  {trade.type?.toUpperCase()}
                </Badge>
              </td>
              <td className="py-3 pr-4">{trade.lots}</td>
              <td className={`py-3 pr-4 font-mono ${(trade.profit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${trade.profit?.toFixed(2)}
              </td>
              <td className="py-3 text-text-secondary">
                {trade.close_time ? new Date(trade.close_time).toLocaleDateString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
