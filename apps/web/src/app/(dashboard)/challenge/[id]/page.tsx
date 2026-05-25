'use client';

import { use } from 'react';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { EquityChart } from '@/components/dashboard/EquityChart';
import { TradeHistory } from '@/components/dashboard/TradeHistory';
import { DrawdownMeter } from '@/components/dashboard/DrawdownMeter';
import { PhaseProgress } from '@/components/dashboard/PhaseProgress';
import { GradientText } from '@/components/shared/GradientText';

const mockEquity = Array.from({ length: 30 }, (_, i) => ({
  date: `Day ${i + 1}`,
  equity: 10000 + Math.sin(i * 0.5) * 300 + i * 25,
}));

const mockTrades = [
  { id: '1', challenge_id: '1', symbol: 'EUR/USD', type: 'buy', lots: 0.5, open_price: 1.08245, close_price: 1.08423, profit: 89.00, open_time: '2026-05-20T10:00:00Z', close_time: '2026-05-20T14:30:00Z' },
  { id: '2', challenge_id: '1', symbol: 'GBP/USD', type: 'sell', lots: 0.3, open_price: 1.26893, close_price: 1.26621, profit: 81.60, open_time: '2026-05-21T09:15:00Z', close_time: '2026-05-21T16:45:00Z' },
];

const mockChallenge = {
  id: '1',
  order_id: 'order-1',
  user_id: 'user-1',
  account_number: 'TV-10001',
  account_password: null,
  server: 'Trivaro-Demo',
  profit_target: 10800,
  max_drawdown: 5,
  daily_drawdown: 3,
  min_trading_days: 5,
  status: 'active' as const,
  current_equity: 10350,
  highest_equity: 10420,
  lowest_equity: 9850,
  total_trades: 47,
  winning_trades: 31,
  created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

export default function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const drawdown = ((mockChallenge.highest_equity! - mockChallenge.lowest_equity!) / mockChallenge.highest_equity!) * 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Challenge <GradientText as="span">#{id.slice(0, 8)}</GradientText>
        </h1>
      </div>

      <AccountCard challenge={mockChallenge} />

      <PhaseProgress currentPhase={1} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityChart data={mockEquity} />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
          <DrawdownMeter current={drawdown} max={mockChallenge.max_drawdown} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-heading text-lg font-semibold">Trade History</h2>
        <TradeHistory trades={mockTrades} />
      </div>
    </div>
  );
}
