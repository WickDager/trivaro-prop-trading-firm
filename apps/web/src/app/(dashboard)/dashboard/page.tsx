'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { EquityChart } from '@/components/dashboard/EquityChart';
import { TradeHistory } from '@/components/dashboard/TradeHistory';
import { DrawdownMeter } from '@/components/dashboard/DrawdownMeter';
import { PhaseProgress } from '@/components/dashboard/PhaseProgress';
import { GradientText } from '@/components/shared/GradientText';
import { Skeleton } from '@/components/ui/skeleton';
import type { Challenge } from '@trivaro/shared-types';
import { TrendingUp, DollarSign, Activity } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

const mockTrades = [
  { id: '1', challenge_id: '1', symbol: 'EUR/USD', type: 'buy', lots: 0.5, open_price: 1.08245, close_price: 1.08423, profit: 89.00, open_time: '2026-05-20T10:00:00Z', close_time: '2026-05-20T14:30:00Z' },
  { id: '2', challenge_id: '1', symbol: 'GBP/USD', type: 'sell', lots: 0.3, open_price: 1.26893, close_price: 1.26621, profit: 81.60, open_time: '2026-05-21T09:15:00Z', close_time: '2026-05-21T16:45:00Z' },
  { id: '3', challenge_id: '1', symbol: 'XAU/USD', type: 'buy', lots: 0.1, open_price: 2358.40, close_price: 2365.80, profit: 74.00, open_time: '2026-05-22T08:00:00Z', close_time: '2026-05-22T12:00:00Z' },
  { id: '4', challenge_id: '1', symbol: 'BTC/USD', type: 'buy', lots: 0.05, open_price: 67432, close_price: 68100, profit: 33.40, open_time: '2026-05-23T15:20:00Z', close_time: '2026-05-23T18:10:00Z' },
];

const mockEquity = Array.from({ length: 30 }, (_, i) => ({
  date: `Day ${i + 1}`,
  equity: 10000 + Math.sin(i * 0.5) * 300 + i * 25,
}));

const mockChallenge: Challenge = {
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
  status: 'active',
  current_equity: 10350,
  highest_equity: 10420,
  lowest_equity: 9850,
  total_trades: 47,
  winning_trades: 31,
  created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
};

export default function DashboardPage() {
  const { supabase } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-text-muted">Please sign in to view your dashboard</p>
      </div>
    );
  }

  const profitPercent = ((mockChallenge.current_equity! - 10000) / 10000) * 100;
  const drawdown = ((mockChallenge.highest_equity! - mockChallenge.lowest_equity!) / mockChallenge.highest_equity!) * 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Welcome back, <GradientText as="span">{user.email?.split('@')[0] ?? 'Trader'}</GradientText>
        </h1>
        <p className="text-sm text-text-secondary">Here&apos;s your trading performance overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">${mockChallenge.current_equity?.toLocaleString()}</p>
            <p className={`text-xs ${profitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Profit Target</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">$800</p>
            <p className="text-xs text-text-muted">8% of $10K account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Trades</CardTitle>
            <Activity className="h-4 w-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">{mockChallenge.total_trades}</p>
            <p className="text-xs text-text-muted">{mockChallenge.winning_trades} winning</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Phase</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">Phase 1</p>
            <p className="text-xs text-text-muted">of 2</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityChart data={mockEquity} />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
          <DrawdownMeter current={drawdown} max={mockChallenge.max_drawdown} />
        </div>
      </div>

      <PhaseProgress currentPhase={1} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeHistory trades={mockTrades} />
        </CardContent>
      </Card>
    </div>
  );
}
