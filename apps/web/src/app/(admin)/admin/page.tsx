'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { Users, ShoppingCart, TrendingUp, FileText, AlertCircle } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  pendingOrders: number;
  activeChallenges: number;
  totalCertificates: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalOrders: 0, pendingOrders: 0,
    activeChallenges: 0, totalCertificates: 0,
  });
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient() as any;
    Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('certificates').select('id', { count: 'exact', head: true }),
      supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(10),
    ]).then(([users, orders, pending, challenges, certs, audit]) => {
      setStats({
        totalUsers: users.count ?? 0,
        totalOrders: orders.count ?? 0,
        pendingOrders: pending.count ?? 0,
        activeChallenges: challenges.count ?? 0,
        totalCertificates: certs.count ?? 0,
      });
      setRecentActions(audit.data ?? []);
      setLoading(false);
    });
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'text-green-400 bg-green-500/10' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: AlertCircle, color: 'text-amber-400 bg-amber-500/10' },
    { label: 'Active Challenges', value: stats.activeChallenges, icon: TrendingUp, color: 'text-teal-400 bg-teal-500/10' },
    { label: 'Certificates', value: stats.totalCertificates, icon: FileText, color: 'text-purple-400 bg-purple-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-xl font-bold">Admin Overview</h1>
        <p className="text-sm text-text-muted">Platform-wide analytics and management</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border border-amber-500/10 bg-navy-700/60 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">{card.label}</p>
                <div className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 font-heading text-2xl font-bold">
                {loading ? '...' : card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-amber-500/10 bg-navy-700/60 p-6">
        <h2 className="mb-4 font-heading text-lg font-semibold">Recent Activity</h2>
        {recentActions.length === 0 ? (
          <p className="text-sm text-text-muted">
            {loading ? 'Loading...' : 'No recent admin activity recorded.'}
          </p>
        ) : (
          <div className="space-y-3">
            {recentActions.map((action: any) => (
              <div key={action.id} className="flex items-center justify-between rounded-lg bg-navy-800/50 px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 uppercase">
                    {action.action}
                  </span>
                  <span className="text-text-secondary">{action.target_type}</span>
                  <code className="text-xs text-text-muted">{action.target_id}</code>
                </div>
                <span className="text-xs text-text-muted">
                  {new Date(action.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
        <p className="text-xs text-amber-400/80">
          <strong>Bootstrap Admin:</strong> Run this SQL in Supabase Dashboard to make a user admin:
          {' '}<code className="font-mono">UPDATE profiles SET role = &apos;admin&apos; WHERE email = &apos;your@email.com&apos;;</code>
        </p>
      </div>
    </div>
  );
}
