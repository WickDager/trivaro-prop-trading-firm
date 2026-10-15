'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, Pagination, type AdminColumn } from '@/components/admin/Table';
import { FilterChips, SectionCard, StatCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, ConfirmActionButton, adminButtonClass } from '@/components/admin/Actions';
import {
  adminAction, downloadCsv, formatDateTime, orderStatusTone, relativeTime, usd, usdCompact,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import { BadgeCheck, Ban, Check, Download, RefreshCw, Search, Undo2, Wallet } from 'lucide-react';

interface Order {
  id: string;
  user_id: string | null;
  payment_id: string;
  account_size: number;
  challenge_type: string;
  amount_usd: number;
  crypto_amount: number | null;
  crypto_currency: string | null;
  network: string | null;
  wallet_address: string | null;
  tx_hash: string | null;
  status: string;
  telegram_username: string | null;
  created_at: string;
  expires_at: string | null;
  paid_at: string | null;
}

const STATUS_FILTERS = ['all', 'pending', 'paid', 'expired', 'cancelled', 'refunded', 'failed'] as const;
const PAGE_SIZE = 25;

type StatusFilter = (typeof STATUS_FILTERS)[number];

/** Stable label for a currency/network pair, e.g. `USDT · TRC20`. */
function assetLabel(currency: string | null, network: string | null): string {
  return `${currency ?? 'USDT'} · ${network ?? 'TRC20'}`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [asset, setAsset] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id,user_id,payment_id,account_size,challenge_type,amount_usd,crypto_amount,crypto_currency,network,wallet_address,tx_hash,status,telegram_username,created_at,expires_at,paid_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data as Order[] | null) ?? [];
    setOrders(rows);

    const userIds = Array.from(new Set(rows.map((o) => o.user_id).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('id,email').in('id', userIds);
      const map: Record<string, string> = {};
      for (const profile of (profiles ?? []) as { id: string; email: string | null }[]) {
        if (profile.email) map[profile.id] = profile.email;
      }
      setEmails(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assets = useMemo(() => {
    const set = new Set(orders.map((order) => assetLabel(order.crypto_currency, order.network)));
    return ['all', ...[...set].sort()];
  }, [orders]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<StatusFilter, number>> = { all: orders.length };
    for (const filter of STATUS_FILTERS) {
      if (filter === 'all') continue;
      counts[filter] = orders.filter((order) => order.status === filter).length;
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (asset !== 'all' && assetLabel(order.crypto_currency, order.network) !== asset) return false;
      if (!needle) return true;
      return (
        order.payment_id.toLowerCase().includes(needle) ||
        (order.wallet_address ?? '').toLowerCase().includes(needle) ||
        (order.tx_hash ?? '').toLowerCase().includes(needle) ||
        (order.telegram_username ?? '').toLowerCase().includes(needle) ||
        (emails[order.user_id ?? ''] ?? '').toLowerCase().includes(needle)
      );
    });
  }, [orders, status, asset, query, emails]);

  const totals = useMemo(() => {
    const paid = filtered.filter((order) => order.status === 'paid');
    return {
      paidVolume: paid.reduce((sum, order) => sum + (Number(order.amount_usd) || 0), 0),
      paidCount: paid.length,
      pending: filtered.filter((order) => order.status === 'pending').length,
      refunded: filtered.filter((order) => order.status === 'refunded').length,
      average: paid.length ? paid.reduce((sum, order) => sum + (Number(order.amount_usd) || 0), 0) / paid.length : 0,
    };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function patchOrder(order: Order, patch: Partial<Order>) {
    setOrders((prev) => prev.map((row) => (row.id === order.id ? { ...row, ...patch } : row)));
  }

  async function setOrderStatus(order: Order, nextStatus: string, message: string) {
    const result = await adminAction<{ challenge_id?: string | null }>('order_status', {
      order_id: order.id,
      status: nextStatus,
    });
    if (!result.ok) return result;
    toast.success(message);
    patchOrder(order, {
      status: nextStatus,
      paid_at: nextStatus === 'paid' ? new Date().toISOString() : order.paid_at,
    });
    if (nextStatus === 'paid' && result.data?.challenge_id) {
      toast.info('A challenge was created for this payment and queued for provisioning.');
    }
    return result;
  }

  async function verifyOnChain(order: Order) {
    const result = await adminAction<{ status?: string; verified?: boolean; reason?: string }>('order_verify_chain', {
      order_id: order.id,
    });
    if (!result.ok) return result;
    const nextStatus = result.data?.status ?? order.status;
    patchOrder(order, { status: nextStatus });
    if (result.data?.verified) {
      toast.success('Payment found on chain — order marked paid');
    } else {
      toast.info(`No matching payment found on chain yet (${result.data?.reason ?? 'not found'})`);
    }
    return result;
  }

  const columns: AdminColumn<Order>[] = [
    {
      key: 'payment',
      header: 'Payment',
      primary: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{row.payment_id}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusPill tone={orderStatusTone(row.status)}>{row.status}</StatusPill>
            <span className="text-[11px] text-text-muted">{formatDateTime(row.created_at)}</span>
          </div>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{row.payment_id}</p>
          <p className="text-[11px] text-text-muted">{formatDateTime(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (row) => (
        <div className="min-w-0">
          {row.user_id ? (
            <Link href={`/admin/traders/${row.user_id}`} className="block max-w-[14rem] truncate text-xs hover:text-amber-300">
              {emails[row.user_id] ?? 'registered user'}
            </Link>
          ) : (
            <span className="text-xs text-text-muted">not linked to an account</span>
          )}
          {row.telegram_username && (
            <p className="truncate text-[11px] text-text-muted">@{row.telegram_username.replace(/^@/, '')}</p>
          )}
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="text-xs">
          {usdCompact(row.account_size)} <span className="text-text-muted capitalize">{row.challenge_type}</span>
        </span>
      ),
    },
    {
      key: 'asset',
      header: 'Asset',
      cell: (row) => <span className="text-xs">{assetLabel(row.crypto_currency, row.network)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      cell: (row) => (
        <div className="min-w-[6rem]">
          <p>{usd.format(Number(row.amount_usd) || 0)}</p>
          {row.crypto_amount != null && (
            <p className="text-[11px] text-text-muted">
              {Number(row.crypto_amount).toFixed(row.network === 'BTC' ? 8 : 2)} {row.crypto_currency ?? 'USDT'}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusPill tone={orderStatusTone(row.status)}>{row.status}</StatusPill>,
    },
    {
      key: 'chain',
      header: 'Chain',
      desktopOnly: true,
      cell: (row) => (
        <div className="min-w-0 text-[11px] text-text-muted">
          {row.tx_hash ? <code className="block truncate">{row.tx_hash.slice(0, 14)}…</code> : <span>no tx yet</span>}
          {row.status === 'pending' && row.expires_at && <span className="block">expires {relativeTime(row.expires_at)}</span>}
        </div>
      ),
    },
  ];

  function exportCsv() {
    downloadCsv('trivaro-payments.csv', [
      ['Payment id', 'Customer', 'Telegram', 'Product', 'Account size', 'Amount USD', 'Crypto amount', 'Currency', 'Network', 'Status', 'Tx hash', 'Created', 'Paid'],
      ...filtered.map((order) => [
        order.payment_id,
        emails[order.user_id ?? ''] ?? '',
        order.telegram_username ?? '',
        order.challenge_type,
        order.account_size,
        Number(order.amount_usd).toFixed(2),
        order.crypto_amount ?? '',
        order.crypto_currency ?? '',
        order.network ?? '',
        order.status,
        order.tx_hash ?? '',
        order.created_at,
        order.paid_at ?? '',
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Payments</h1>
          <p className="text-sm text-text-muted">
            Confirm crypto payments, re-check the chain, refund or cancel. Marking an order paid creates its challenge.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={adminButtonClass('secondary')} onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            className={adminButtonClass('secondary')}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not load payments: {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Collected (filtered)"
          value={usdCompact(totals.paidVolume)}
          hint={`${totals.paidCount} paid · ${usdCompact(totals.average)} average`}
          icon={Wallet}
          tone="success"
        />
        <StatCard label="Awaiting payment" value={totals.pending} hint="Pending orders needing review" icon={RefreshCw} tone={totals.pending ? 'warn' : 'neutral'} />
        <StatCard label="Refunded" value={totals.refunded} hint="Refunds issued" icon={Undo2} tone={totals.refunded ? 'info' : 'neutral'} />
        <StatCard label="Orders loaded" value={orders.length} hint="Newest 500 orders" icon={Check} tone="info" />
      </div>

      <SectionCard title="Filters" description="Search by payment id, wallet, tx hash, email or Telegram handle.">
        <div className="space-y-3">
          <div className="relative sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search payments…"
              aria-label="Search payments"
              className="w-full rounded-lg border border-amber-500/10 bg-navy-800 py-2 pl-9 pr-3 text-sm placeholder:text-text-muted focus:border-amber-400/40 focus:outline-none"
            />
          </div>
          <FilterChips
            ariaLabel="Filter by status"
            options={STATUS_FILTERS}
            value={status}
            onChange={(next) => {
              setStatus(next);
              setPage(0);
            }}
            labels={{ all: 'All' }}
            counts={statusCounts}
          />
          {assets.length > 1 && (
            <FilterChips
              ariaLabel="Filter by asset"
              options={assets}
              value={asset}
              onChange={(next) => {
                setAsset(next);
                setPage(0);
              }}
              labels={{ all: 'All assets' }}
            />
          )}
        </div>
      </SectionCard>

      <AdminTable
        rows={paged}
        columns={columns}
        getRowKey={(row) => row.id}
        loading={loading}
        empty={<p className="py-8 text-center text-sm text-text-muted">No payments match these filters.</p>}
        actions={(row) => (
          <>
            {row.status === 'pending' && (
              <>
                <AsyncButton
                  variant="primary"
                  icon={BadgeCheck}
                  title="Ask the verifier to look for this payment on chain"
                  onRun={() => verifyOnChain(row)}
                >
                  Verify chain
                </AsyncButton>
                <AsyncButton
                  variant="success"
                  icon={Check}
                  title="Confirm the payment manually and create the challenge"
                  onRun={() => setOrderStatus(row, 'paid', 'Payment marked paid')}
                >
                  Mark paid
                </AsyncButton>
                <ConfirmActionButton
                  label="Cancel"
                  confirmLabel="Confirm cancel"
                  variant="danger"
                  icon={Ban}
                  title="Cancel this order"
                  onRun={() => setOrderStatus(row, 'cancelled', 'Order cancelled')}
                />
              </>
            )}
            {row.status === 'expired' && (
              <AsyncButton
                variant="success"
                icon={Check}
                title="Accept a late payment — this re-opens the order and marks it paid"
                onRun={() => setOrderStatus(row, 'paid', 'Late payment accepted')}
              >
                Accept payment
              </AsyncButton>
            )}
            {row.status === 'paid' && (
              <ConfirmActionButton
                label="Refund"
                confirmLabel="Confirm refund"
                variant="danger"
                icon={Undo2}
                title="Record a refund for this payment"
                onRun={() => setOrderStatus(row, 'refunded', 'Payment marked refunded')}
              />
            )}
          </>
        )}
        footer={<Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />}
      />
    </div>
  );
}
