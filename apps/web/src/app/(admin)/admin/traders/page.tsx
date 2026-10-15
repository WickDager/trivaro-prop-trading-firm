'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, Pagination, type AdminColumn } from '@/components/admin/Table';
import { FilterChips, SectionCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, ConfirmActionButton, adminButtonClass } from '@/components/admin/Actions';
import {
  adminAction, downloadCsv, formatDate, kycLabel, kycTone, roleTone, usd, usdCompact, relativeTime,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import {
  BadgeCheck, Download, Search, Shield, ShieldOff, UserRound, RefreshCw,
} from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  telegram_username: string | null;
  role: string;
  kyc_status: string | null;
  created_at: string;
}

interface TraderRow extends Profile {
  displayName: string;
  liveAccounts: number;
  totalAccounts: number;
  paidTotal: number;
  paidOrders: number;
  lastPaidAt: string | null;
}

const ROLE_FILTERS = ['all', 'trader', 'reviewer', 'admin'] as const;
const KYC_FILTERS = ['all', 'pending', 'verified', 'rejected', 'none'] as const;
const PAGE_SIZE = 25;

type RoleFilter = (typeof ROLE_FILTERS)[number];
type KycFilter = (typeof KYC_FILTERS)[number];

function displayNameOf(profile: Profile): string {
  const fromParts = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
  return profile.full_name?.trim() || fromParts || profile.email?.split('@')[0] || 'Unnamed trader';
}

export default function AdminTradersPage() {
  const [rows, setRows] = useState<TraderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [kyc, setKyc] = useState<KycFilter>('all');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();
    const [profilesRes, challengesRes, ordersRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,email,full_name,first_name,last_name,telegram_username,role,kyc_status,created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase.from('challenges').select('user_id,status,is_trial').limit(2000),
      supabase.from('orders').select('user_id,amount_usd,status,paid_at,created_at').limit(2000),
    ]);

    if (profilesRes.error) {
      setError(profilesRes.error.message);
      setLoading(false);
      return;
    }

    const liveByUser = new Map<string, number>();
    const totalByUser = new Map<string, number>();
    for (const challenge of (challengesRes.data ?? []) as { user_id: string | null; status: string }[]) {
      if (!challenge.user_id) continue;
      totalByUser.set(challenge.user_id, (totalByUser.get(challenge.user_id) ?? 0) + 1);
      if (['trial', 'active', 'phase1_complete', 'phase2_complete', 'funded'].includes(challenge.status)) {
        liveByUser.set(challenge.user_id, (liveByUser.get(challenge.user_id) ?? 0) + 1);
      }
    }

    const paidByUser = new Map<string, { total: number; count: number; last: string | null }>();
    for (const order of (ordersRes.data ?? []) as {
      user_id: string | null; amount_usd: number; status: string; paid_at: string | null; created_at: string;
    }[]) {
      if (!order.user_id || order.status !== 'paid') continue;
      const entry = paidByUser.get(order.user_id) ?? { total: 0, count: 0, last: null };
      entry.total += Number(order.amount_usd) || 0;
      entry.count += 1;
      const when = order.paid_at ?? order.created_at;
      if (!entry.last || when > entry.last) entry.last = when;
      paidByUser.set(order.user_id, entry);
    }

    setRows(
      ((profilesRes.data ?? []) as Profile[]).map((profile) => {
        const paid = paidByUser.get(profile.id);
        return {
          ...profile,
          displayName: displayNameOf(profile),
          liveAccounts: liveByUser.get(profile.id) ?? 0,
          totalAccounts: totalByUser.get(profile.id) ?? 0,
          paidTotal: paid?.total ?? 0,
          paidOrders: paid?.count ?? 0,
          lastPaidAt: paid?.last ?? null,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (role !== 'all' && row.role !== role) return false;
      if (kyc === 'none' && row.kyc_status) return false;
      if (kyc !== 'all' && kyc !== 'none' && row.kyc_status !== kyc) return false;
      if (!needle) return true;
      return (
        row.displayName.toLowerCase().includes(needle) ||
        (row.email ?? '').toLowerCase().includes(needle) ||
        (row.telegram_username ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, search, role, kyc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  async function setKycStatus(userId: string, status: 'verified' | 'rejected') {
    const result = await adminAction('set_kyc', { user_id: userId, status });
    if (!result.ok) return result;
    toast.success(status === 'verified' ? 'Trader verified' : 'Verification rejected');
    setRows((prev) => prev.map((row) => (row.id === userId ? { ...row, kyc_status: status } : row)));
    return result;
  }

  async function changeRole(userId: string, nextRole: 'trader' | 'admin') {
    const result = await adminAction('set_role', { user_id: userId, role: nextRole });
    if (!result.ok) return result;
    toast.success(nextRole === 'admin' ? 'Admin access granted' : 'Admin access removed');
    setRows((prev) => prev.map((row) => (row.id === userId ? { ...row, role: nextRole } : row)));
    return result;
  }

  const columns: AdminColumn<TraderRow>[] = [
    {
      key: 'trader',
      header: 'Trader',
      primary: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/traders/${row.id}`} className="truncate text-sm font-medium hover:text-amber-300">
            {row.displayName}
          </Link>
          <p className="truncate text-[11px] text-text-muted">{row.email ?? 'no email'}</p>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/traders/${row.id}`} className="text-sm font-medium hover:text-amber-300">
            {row.displayName}
          </Link>
          <p className="text-[11px] text-text-muted">
            {row.email ?? 'no email'}
            {row.telegram_username ? ` · @${row.telegram_username.replace(/^@/, '')}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (row) => <StatusPill tone={roleTone(row.role)}>{row.role}</StatusPill>,
    },
    {
      key: 'kyc',
      header: 'KYC',
      cell: (row) => <StatusPill tone={kycTone(row.kyc_status)}>{kycLabel(row.kyc_status)}</StatusPill>,
    },
    {
      key: 'accounts',
      header: 'Accounts',
      numeric: true,
      cell: (row) => (
        <span>
          {row.liveAccounts}
          <span className="text-text-muted"> / {row.totalAccounts}</span>
        </span>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      numeric: true,
      cell: (row) => (
        <span>
          {usdCompact(row.paidTotal)}
          <span className="text-text-muted"> · {row.paidOrders}</span>
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last payment',
      cell: (row) => <span className="text-xs text-text-muted">{row.lastPaidAt ? relativeTime(row.lastPaidAt) : '—'}</span>,
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
  ];

  function exportCsv() {
    downloadCsv('trivaro-traders.csv', [
      ['Name', 'Email', 'Telegram', 'Role', 'KYC', 'Live accounts', 'Total accounts', 'Paid (USD)', 'Paid orders', 'Joined'],
      ...filtered.map((row) => [
        row.displayName,
        row.email,
        row.telegram_username,
        row.role,
        row.kyc_status,
        row.liveAccounts,
        row.totalAccounts,
        row.paidTotal.toFixed(2),
        row.paidOrders,
        row.created_at,
      ]),
    ]);
  }

  const pendingKyc = rows.filter((row) => row.kyc_status === 'pending').length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Traders</h1>
          <p className="text-sm text-text-muted">
            {rows.length} accounts · {pendingKyc} awaiting verification
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
          Could not load traders: {error}
        </div>
      )}

      <SectionCard title="Filters" description="Search by name, email or Telegram handle.">
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search traders…"
              aria-label="Search traders"
              className="w-full rounded-lg border border-amber-500/10 bg-navy-800 py-2 pl-9 pr-3 text-sm placeholder:text-text-muted focus:border-amber-400/40 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <FilterChips
              ariaLabel="Filter by role"
              options={ROLE_FILTERS}
              value={role}
              onChange={(next) => {
                setRole(next);
                setPage(0);
              }}
              labels={{ all: 'All roles' }}
            />
            <FilterChips
              ariaLabel="Filter by KYC status"
              options={KYC_FILTERS}
              value={kyc}
              onChange={(next) => {
                setKyc(next);
                setPage(0);
              }}
              labels={{ all: 'All KYC', none: 'Not submitted' }}
            />
          </div>
        </div>
      </SectionCard>

      <AdminTable
        rows={paged}
        columns={columns}
        getRowKey={(row) => row.id}
        loading={loading}
        empty={
          <p className="py-8 text-center text-sm text-text-muted">
            {rows.length ? 'No traders match these filters.' : 'No traders yet.'}
          </p>
        }
        actions={(row) => (
          <>
            {row.kyc_status !== 'verified' && (
              <AsyncButton
                variant="success"
                icon={BadgeCheck}
                title="Mark this trader as identity-verified"
                onRun={() => setKycStatus(row.id, 'verified')}
              >
                Verify
              </AsyncButton>
            )}
            {row.kyc_status === 'pending' && (
              <AsyncButton
                variant="danger"
                icon={ShieldOff}
                title="Reject this identity check"
                onRun={() => setKycStatus(row.id, 'rejected')}
              >
                Reject
              </AsyncButton>
            )}
            {row.role === 'admin' ? (
              <ConfirmActionButton
                label="Demote"
                confirmLabel="Confirm demote"
                variant="secondary"
                icon={ShieldOff}
                title="Remove admin access"
                onRun={() => changeRole(row.id, 'trader')}
              />
            ) : (
              <ConfirmActionButton
                label="Make admin"
                confirmLabel="Confirm promote"
                variant="secondary"
                icon={Shield}
                title="Grant admin access"
                onRun={() => changeRole(row.id, 'admin')}
              />
            )}
            <Link href={`/admin/traders/${row.id}`} className={adminButtonClass('ghost', 'sm')}>
              <UserRound className="h-3.5 w-3.5" />
              View
            </Link>
          </>
        )}
        footer={
          <Pagination
            page={safePage}
            pageCount={pageCount}
            total={filtered.length}
            onPage={setPage}
          />
        }
      />

      <p className="text-[11px] text-text-muted">
        Total paid volume across all traders:{' '}
        {usd.format(rows.reduce((sum, row) => sum + row.paidTotal, 0))}
      </p>
    </div>
  );
}
