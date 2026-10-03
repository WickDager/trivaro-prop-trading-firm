'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

interface ChallengeRow {
  id: string;
  account_number: string | null;
  /** There is no `challenges.account_size` column — the size comes from
   *  `starting_balance`. Reading `account_size` rendered "NaN K". */
  starting_balance: number;
  status: string;
  current_equity: number | null;
  total_trades: number;
  created_at: string;
  user_id: string | null;
}

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient();
    // Explicit columns: `select('*')` also pulled `account_password` (the MT5
    // credentials) into the admin's browser and the RSC payload.
    supabase
      .from('challenges')
      .select('id,account_number,starting_balance,status,current_equity,total_trades,created_at,user_id')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
        } else {
          setChallenges((data as ChallengeRow[] | null) ?? []);
        }
        setLoading(false);
      });
  }, []);

  const filtered = filter === 'all' ? challenges : challenges.filter((c) => c.status === filter);
  const statusFilters = ['all', 'active', 'phase1_complete', 'phase2_complete', 'funded', 'failed'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold">Challenges</h1>
        <p className="text-sm text-text-muted">Monitor all active and completed challenges</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not load challenges: {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {statusFilters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-lg px-3 py-2 text-xs font-medium transition-colors active:scale-[0.97] ${
              filter === f
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-navy-800 text-text-muted hover:text-white'
            }`}
          >
            {f.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-500/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-500/10 bg-navy-800/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Equity</th>
              <th className="px-4 py-3 font-medium">Trades</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Started</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No challenges found</td></tr>
            ) : (
              filtered.map((ch) => (
                <tr key={ch.id} className="border-b border-amber-500/5 hover:bg-navy-700/30">
                  <td className="px-4 py-3 font-mono text-xs">{ch.account_number || '—'}</td>
                  <td className="px-4 py-3">
                    {ch.starting_balance ? `$${(ch.starting_balance / 1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {ch.current_equity != null ? `$${ch.current_equity.toLocaleString('en-US')}` : '—'}
                  </td>
                  <td className="px-4 py-3">{ch.total_trades}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      ch.status === 'funded' ? 'bg-green-500/10 text-green-400'
                      : ch.status === 'active' ? 'bg-teal-500/10 text-teal-400'
                      : ch.status === 'failed' ? 'bg-red-500/10 text-red-400'
                      : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {ch.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">
                    {new Date(ch.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
