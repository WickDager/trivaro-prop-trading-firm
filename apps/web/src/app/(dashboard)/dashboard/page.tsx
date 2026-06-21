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
import { TrendingUp, DollarSign, Activity, AlertCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types';

type TradeRow = Database['public']['Tables']['trades']['Row'];
type EquitySnapshotRow = Database['public']['Tables']['equity_snapshots']['Row'];

function getPhaseNumber(status: string): number {
  if (status === 'active' || status === 'phase1_complete') return 1;
  if (status === 'phase2_complete') return 2;
  if (status === 'funded') return 3;
  return 1;
}

function getPhaseLabel(status: string): string {
  if (status === 'active') return 'Phase 1';
  if (status === 'phase1_complete') return 'Phase 2';
  if (status === 'phase2_complete') return 'Phase 2';
  if (status === 'funded') return 'Funded';
  return 'Phase 1';
}

export default function DashboardPage() {
  const { supabase } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [equityData, setEquityData] = useState<{ date: string; equity: number }[]>([]);
  const [noChallenge, setNoChallenge] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const u = authData.user ?? null;
      setUser(u);
      if (!u) { setLoading(false); return; }

      // Fetch challenge
      const { data: challengeData, error: challengeErr } = await supabase
        .from('challenges')
        .select('id,status,current_equity,starting_balance,highest_equity,profit_target,max_drawdown,total_trades,winning_trades,trading_days,account_number,created_at')
        .eq('user_id', u.id)
        .in('status', ['active', 'phase1_complete', 'phase2_complete', 'funded'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (challengeErr || !challengeData) {
        setNoChallenge(true);
        setLoading(false);
        return;
      }

      const c = challengeData as unknown as Challenge;
      setChallenge(c);

      // Fetch trades + snapshots in parallel
      const [{ data: tradesData }, { data: snapshots }] = await Promise.all([
        supabase.from('trades').select('id,symbol,type,lots,profit,close_time').eq('challenge_id', c.id).order('close_time', { ascending: false }).limit(50),
        supabase.from('equity_snapshots').select('snapshot_date,equity').eq('challenge_id', c.id).order('snapshot_date', { ascending: true }),
      ]);

      setTrades((tradesData ?? []) as unknown as TradeRow[]);

      if (snapshots && snapshots.length > 0) {
        setEquityData(
          snapshots.map((s: EquitySnapshotRow) => ({
            date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            equity: s.equity,
          })),
        );
      }

      setLoading(false);
    }

    load();
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

  if (noChallenge || !challenge) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Welcome, <GradientText as="span">{user.email?.split('@')[0] ?? 'Trader'}</GradientText>
          </h1>
        </div>
        <div className="flex h-[40vh] flex-col items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60 p-8 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-text-muted" />
          <h2 className="mb-2 font-heading text-xl font-bold">No Active Challenge</h2>
          <p className="text-sm text-text-secondary">You don&apos;t have an active challenge yet. Start one to begin trading.</p>
        </div>
      </div>
    );
  }

  const startingBalance = challenge.starting_balance || 10000;
  const equity = challenge.current_equity ?? startingBalance;
  const profitPercent = ((equity - startingBalance) / startingBalance) * 100;

  const highestEquity = challenge.highest_equity ?? equity;
  const drawdown = highestEquity > 0 ? ((highestEquity - equity) / highestEquity) * 100 : 0;

  const profitTargetDollars = startingBalance * 0.08;
  const phase = getPhaseNumber(challenge.status);

  // Fallback equity chart if no snapshots yet
  const chartData = equityData.length > 0
    ? equityData
    : [{ date: 'Start', equity: startingBalance }];

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
            <p className="font-heading text-2xl font-bold">${equity.toLocaleString()}</p>
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
            <p className="font-heading text-2xl font-bold">${profitTargetDollars.toLocaleString()}</p>
            <p className="text-xs text-text-muted">8% of ${startingBalance.toLocaleString()} account</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Trades</CardTitle>
            <Activity className="h-4 w-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">{challenge.total_trades}</p>
            <p className="text-xs text-text-muted">{challenge.winning_trades} winning ({challenge.trading_days} days)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Phase</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-400" />
          </CardHeader>
          <CardContent>
            <p className="font-heading text-2xl font-bold">{getPhaseLabel(challenge.status)}</p>
            <p className="text-xs text-text-muted">{challenge.status === 'funded' ? 'Complete' : `of 2`}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityChart data={chartData} />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
          <DrawdownMeter current={drawdown} max={challenge.max_drawdown} />
        </div>
      </div>

      <PhaseProgress currentPhase={phase} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <TradeHistory trades={trades} loading={false} />
        </CardContent>
      </Card>
    </div>
  );
}
