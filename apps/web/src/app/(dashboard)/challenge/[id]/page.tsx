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
type EquitySnapshotRow = Database['public']['Tables']['equity_snapshots']['Row'];

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
      const { data: challengeData, error: challengeErr } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', id)
        .eq('user_id', authData.user.id)
        .single();

      if (challengeErr || !challengeData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setChallenge(challengeData as unknown as Challenge);

      // Fetch trades
      const { data: tradesData } = await supabase
        .from('trades')
        .select('*')
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
          snapshots.map((s: EquitySnapshotRow) => ({
            date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
