'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { FileText } from 'lucide-react';

interface ChallengeRow {
  id: string;
  account_number: string | null;
  account_size: number;
  status: string;
  current_equity: number | null;
  total_trades: number;
  created_at: string;
  user_id: string;
}

export default function AdminChallengesPage() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.from('challenges').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setChallenges(data as ChallengeRow[] ?? []);
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

      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
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
                  <td className="px-4 py-3">${(ch.account_size / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3">${ch.current_equity?.toLocaleString() || '—'}</td>
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
