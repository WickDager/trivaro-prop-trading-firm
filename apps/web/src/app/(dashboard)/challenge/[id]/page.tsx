'use client';

import { useEffect, useState, use } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { AccountCard } from '@/components/dashboard/AccountCard';
import { EquityChart } from '@/components/dashboard/EquityChart';
import { TradeHistory } from '@/components/dashboard/TradeHistory';
import { DrawdownMeter } from '@/components/dashboard/DrawdownMeter';
import { PhaseProgress } from '@/components/dashboard/PhaseProgress';
import { GradientText } from '@/components/shared/GradientText';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import type { Challenge } from '@trivaro/shared-types';
import type { Database } from '@/types';

type TradeRow = Database['public']['Tables']['trades']['Row'];
type EquityPointRow = Pick<Database['public']['Tables']['equity_snapshots']['Row'], 'snapshot_date' | 'equity'>;

/** Bare `YYYY-MM-DD` parsed as UTC midnight renders as the previous day in
 *  negative-offset timezones. Build the date in local time instead. */
function formatSnapshotDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPhaseNumber(status: string): number {
  if (status === 'active' || status === 'phase1_complete') return 1;
  if (status === 'phase2_complete') return 2;
  if (status === 'funded') return 3;
  return 1;
}

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { supabase } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [equityData, setEquityData] = useState<{ date: string; equity: number }[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      // Check auth
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      // Fetch challenge
      // Explicit columns — `select('*')` also returned `account_password`
      // (the MT5 login) into the browser, and `server`.
      const { data: challengeData, error: challengeErr } = await supabase
        .from('challenges')
        .select('id,status,current_equity,starting_balance,highest_equity,lowest_equity,profit_target,max_drawdown,daily_drawdown,min_trading_days,total_trades,winning_trades,trading_days,account_number,created_at,is_trial,trial_ends_at,trial_passed_at')
        .eq('id', id)
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (challengeErr || !challengeData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setChallenge(challengeData as unknown as Challenge);

      // Fetch trades
      // Explicit columns, matching what TradeHistory actually renders. The
      // challenge query above avoids `select('*')` because it pulled
      // `account_password` into the browser; hold the same line here.
      const { data: tradesData } = await supabase
        .from('trades')
        .select('id,symbol,type,lots,profit,close_time')
        .eq('challenge_id', id)
        .order('close_time', { ascending: false })
        .limit(100);

      setTrades((tradesData ?? []) as unknown as TradeRow[]);

      // Fetch equity snapshots
      const { data: snapshots } = await supabase
        .from('equity_snapshots')
        .select('snapshot_date, equity')
        .eq('challenge_id', id)
        .order('snapshot_date', { ascending: true });

      if (snapshots && snapshots.length > 0) {
        setEquityData(
          snapshots.map((s: EquityPointRow) => ({
            date: formatSnapshotDate(s.snapshot_date),
            equity: s.equity,
          })),
        );
      }

      setLoading(false);
    }

    load();
  }, [supabase, id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (notFound || !challenge) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-text-muted" />
        <h1 className="mb-2 font-heading text-xl font-bold">Challenge Not Found</h1>
        <p className="text-sm text-text-secondary">This challenge doesn&apos;t exist or you don&apos;t have access to it.</p>
      </div>
    );
  }

  const startingBalance = challenge.starting_balance || 10000;
  const equity = challenge.current_equity ?? startingBalance;
  const highestEquity = challenge.highest_equity ?? equity;
  const drawdown = highestEquity > 0 ? ((highestEquity - equity) / highestEquity) * 100 : 0;
  const phase = getPhaseNumber(challenge.status);

  const chartData = equityData.length > 0
    ? equityData
    : [{ date: 'Start', equity: startingBalance }];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Challenge <GradientText as="span">#{id.slice(0, 8)}</GradientText>
        </h1>
      </div>

      <AccountCard challenge={challenge} />

      <PhaseProgress currentPhase={phase} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EquityChart data={chartData} />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
          <DrawdownMeter current={drawdown} max={challenge.max_drawdown} />
        </div>
      </div>

      <div>
        <h2 className="mb-4 font-heading text-lg font-semibold">Trade History</h2>
        <TradeHistory trades={trades} loading={false} />
      </div>
    </div>
  );
}
