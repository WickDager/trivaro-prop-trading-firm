'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Check, X } from 'lucide-react';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
);

interface OrderRow {
  id: string;
  payment_id: string;
  account_size: number;
  amount_usd: number;
  status: string;
  crypto_amount: number | null;
  wallet_address: string | null;
  telegram_username: string | null;
  created_at: string;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    sb.from('orders').select('*').order('created_at', { ascending: false }).then(({ data }: any) => {
      setOrders((data as OrderRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all' ? orders : orders.filter((o: OrderRow) => o.status === filter);

  async function updateStatus(orderId: string, status: string) {
    await (sb.from('orders') as any).update({ status }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
  }

  const statusFilters = ['all', 'pending', 'paid', 'expired', 'cancelled'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold">Orders</h1>
        <p className="text-sm text-text-muted">Review and manage payment orders</p>
      </div>

      <div className="flex gap-2">
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
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-500/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-500/10 bg-navy-800/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Payment ID</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Telegram</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No orders found</td></tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id} className="border-b border-amber-500/5 hover:bg-navy-700/30">
                  <td className="px-4 py-3 font-mono text-xs">{order.payment_id}</td>
                  <td className="px-4 py-3">${(order.account_size / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3">${order.amount_usd}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      order.status === 'paid' ? 'bg-green-500/10 text-green-400'
                      : order.status === 'pending' ? 'bg-amber-500/10 text-amber-400'
                      : order.status === 'expired' ? 'bg-red-500/10 text-red-400'
                      : 'bg-navy-500 text-text-muted'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{order.telegram_username || '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateStatus(order.id, 'paid')}
                            className="rounded p-1 text-green-400 hover:bg-green-500/10"
                            title="Mark as paid"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => updateStatus(order.id, 'cancelled')}
                            className="rounded p-1 text-red-400 hover:bg-red-500/10"
                            title="Cancel order"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
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
