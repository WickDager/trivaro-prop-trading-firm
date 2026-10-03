'use client';

import { useCallback, useEffect, useState } from 'react';
// The cookie-aware client. A plain `createClient` from @supabase/supabase-js
// reads the session from localStorage, but @supabase/ssr stores it in cookies —
// so the old module-scope client was anonymous, every query returned nothing,
// and the "Mark as paid" write silently failed while the UI showed success.
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/components/ui/toast';
import { Check, X } from 'lucide-react';

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

const STATUS_FILTERS = ['all', 'pending', 'paid', 'expired', 'cancelled'] as const;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    const supabase = createBrowserClient();
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id,payment_id,account_size,amount_usd,status,crypto_amount,wallet_address,telegram_username,created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (queryError) {
      setError(queryError.message);
    } else {
      setOrders((data as OrderRow[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  async function updateStatus(orderId: string, status: string) {
    const supabase = createBrowserClient();
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    // Only reflect the change once the database has actually accepted it.
    if (updateError) {
      toast.error(`Could not update order: ${updateError.message}`);
      return;
    }
    toast.success(`Order marked ${status}`);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold">Orders</h1>
        <p className="text-sm text-text-muted">Review and manage payment orders</p>
      </div>

      <div className="-mx-1 flex flex-wrap gap-2 px-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`min-h-10 rounded-lg px-3 py-2 text-xs font-medium transition-colors active:scale-[0.97] ${
              filter === f
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-navy-800 text-text-muted hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not load orders: {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-amber-500/10">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-amber-500/10 bg-navy-800/50 text-left text-text-muted">
              <th className="whitespace-nowrap px-4 py-3 font-medium">Payment ID</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Account</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Amount</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Telegram</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-text-muted">No orders found</td></tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id} className="border-b border-amber-500/5 hover:bg-navy-700/30">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{order.payment_id}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {order.account_size ? `$${(order.account_size / 1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {money.format(Number(order.amount_usd) || 0)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      order.status === 'paid' ? 'bg-green-500/10 text-green-400'
                      : order.status === 'pending' ? 'bg-amber-500/10 text-amber-400'
                      : order.status === 'expired' ? 'bg-red-500/10 text-red-400'
                      : 'bg-navy-500 text-text-muted'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-text-muted">{order.telegram_username || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                    {new Date(order.created_at).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {order.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, 'paid')}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-green-400 transition-colors hover:bg-green-500/10 active:bg-green-500/20"
                            aria-label={`Mark order ${order.payment_id} as paid`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, 'cancelled')}
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/10 active:bg-red-500/20"
                            aria-label={`Cancel order ${order.payment_id}`}
                          >
                            <X className="h-4 w-4" />
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
