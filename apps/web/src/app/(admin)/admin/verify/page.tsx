'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, type AdminColumn } from '@/components/admin/Table';
import { SectionCard, StatCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, ConfirmActionButton, adminButtonClass } from '@/components/admin/Actions';
import {
  adminAction, challengeStatusLabel, challengeStatusTone, formatDate, kycLabel, orderStatusTone,
  relativeTime, usd, usdCompact,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import {
  BadgeCheck, Ban, Check, Eye, ExternalLink, KeyRound, RefreshCw, ShieldCheck, UserCheck, Wallet,
} from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: string;
  kyc_status: string | null;
  created_at: string;
}

interface Challenge {
  id: string;
  user_id: string | null;
  account_number: string | null;
  status: string;
  is_trial: boolean;
  credential_status: string | null;
  starting_balance: number;
  created_at: string;
}

interface Order {
  id: string;
  user_id: string | null;
  payment_id: string;
  amount_usd: number;
  crypto_currency: string | null;
  network: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
}

function nameOf(profile: Profile): string {
  return (
    profile.full_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
    profile.email?.split('@')[0] ||
    'Unnamed trader'
  );
}

export default function AdminVerifyPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();
    const [profilesRes, challengesRes, ordersRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,email,full_name,first_name,last_name,role,kyc_status,created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('challenges')
        .select('id,user_id,account_number,status,is_trial,credential_status,starting_balance,created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('orders')
        .select('id,user_id,payment_id,amount_usd,crypto_currency,network,status,created_at,expires_at')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (profilesRes.error) {
      setError(profilesRes.error.message);
      setLoading(false);
      return;
    }

    setProfiles((profilesRes.data as Profile[] | null) ?? []);
    setChallenges((challengesRes.data as Challenge[] | null) ?? []);
    setOrders((ordersRes.data as Order[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profileById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const profile of profiles) map[profile.id] = profile;
    return map;
  }, [profiles]);

  const paidByUser = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const order of orders) {
      if (order.status !== 'paid' || !order.user_id) continue;
      const entry = map[order.user_id] ?? { total: 0, count: 0 };
      entry.total += Number(order.amount_usd) || 0;
      entry.count += 1;
      map[order.user_id] = entry;
    }
    return map;
  }, [orders]);

  const challengeCountByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const challenge of challenges) {
      if (!challenge.user_id) continue;
      map[challenge.user_id] = (map[challenge.user_id] ?? 0) + 1;
    }
    return map;
  }, [challenges]);

  /**
   * Identity queue: unverified traders who actually have skin in the game (a
   * paid order or a challenge). Listing every new signup who has never bought
   * anything would bury the ones that matter.
   */
  const kycQueue = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.kyc_status !== 'verified' &&
          profile.kyc_status !== 'rejected' &&
          (profile.role === 'trader' || profile.role === 'reviewer') &&
          ((paidByUser[profile.id]?.count ?? 0) > 0 || (challengeCountByUser[profile.id] ?? 0) > 0),
      ),
    [profiles, paidByUser, challengeCountByUser],
  );

  /** Accounts nobody has authorised yet: live or trial accounts with no
   *  credential lifecycle started. */
  const authoriseQueue = useMemo(
    () =>
      challenges.filter(
        (challenge) =>
          (!challenge.credential_status || challenge.credential_status === 'none') &&
          ['trial', 'active', 'phase1_complete', 'phase2_complete', 'funded'].includes(challenge.status),
      ),
    [challenges],
  );

  const provisioningQueue = useMemo(
    () => challenges.filter((challenge) => challenge.credential_status === 'pending'),
    [challenges],
  );

  const paymentQueue = useMemo(
    () => orders.filter((order) => order.status === 'pending'),
    [orders],
  );

  async function setKyc(userId: string, status: 'verified' | 'rejected') {
    const result = await adminAction('set_kyc', { user_id: userId, status });
    if (!result.ok) return result;
    toast.success(status === 'verified' ? 'Identity verified' : 'Identity rejected');
    setProfiles((prev) => prev.map((p) => (p.id === userId ? { ...p, kyc_status: status } : p)));
    return result;
  }

  async function authorise(challengeId: string) {
    const result = await adminAction('challenge_authorize', { challenge_id: challengeId });
    if (!result.ok) return result;
    toast.success('Account authorised — it now appears in the provisioning queue');
    setChallenges((prev) =>
      prev.map((c) => (c.id === challengeId ? { ...c, credential_status: 'pending' } : c)),
    );
    return result;
  }

  async function setOrderStatus(orderId: string, status: string, message: string) {
    const result = await adminAction('order_status', { order_id: orderId, status });
    if (!result.ok) return result;
    toast.success(message);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    return result;
  }

  async function verifyChain(orderId: string) {
    const result = await adminAction<{ status?: string; verified?: boolean }>('order_verify_chain', { order_id: orderId });
    if (!result.ok) return result;
    const next = result.data?.status;
    if (next) setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
    if (result.data?.verified) toast.success('Payment confirmed on chain');
    else toast.info('No matching on-chain payment found yet');
    return result;
  }

  const kycColumns: AdminColumn<Profile>[] = [
    {
      key: 'trader',
      header: 'Trader',
      primary: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/traders/${row.id}`} className="truncate text-sm font-medium hover:text-amber-300">
            {nameOf(row)}
          </Link>
          <p className="truncate text-[11px] text-text-muted">{row.email ?? 'no email'}</p>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/traders/${row.id}`} className="text-sm font-medium hover:text-amber-300">
            {nameOf(row)}
          </Link>
          <p className="text-[11px] text-text-muted">{row.email ?? 'no email'}</p>
        </div>
      ),
    },
    {
      key: 'kyc',
      header: 'Status',
      cell: (row) => <StatusPill tone={row.kyc_status ? 'warn' : 'neutral'}>{kycLabel(row.kyc_status)}</StatusPill>,
    },
    {
      key: 'paid',
      header: 'Paid',
      numeric: true,
      cell: (row) => (
        <span>
          {usdCompact(paidByUser[row.id]?.total ?? 0)}
          <span className="text-text-muted"> · {paidByUser[row.id]?.count ?? 0}</span>
        </span>
      ),
    },
    {
      key: 'accounts',
      header: 'Accounts',
      numeric: true,
      cell: (row) => challengeCountByUser[row.id] ?? 0,
    },
    {
      key: 'joined',
      header: 'Joined',
      cell: (row) => <span className="text-xs text-text-muted">{formatDate(row.created_at)}</span>,
    },
  ];

  const authoriseColumns: AdminColumn<Challenge>[] = [
    {
      key: 'account',
      header: 'Account',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/challenges/${row.id}`} className="font-mono text-xs hover:text-amber-300">
            {row.account_number ?? row.id.slice(0, 8)}
          </Link>
          <StatusPill tone={challengeStatusTone(row.status)}>{challengeStatusLabel(row.status)}</StatusPill>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/challenges/${row.id}`} className="font-mono text-xs hover:text-amber-300">
            {row.account_number ?? row.id.slice(0, 8)}
          </Link>
          <p className="text-[11px] text-text-muted">
            {row.is_trial ? 'Free trial' : usdCompact(row.starting_balance)}
          </p>
        </div>
      ),
    },
    {
      key: 'trader',
      header: 'Trader',
      // An orphaned challenge has no user_id; linking to /admin/traders/null
      // produced a "Trader not found" dead end.
      cell: (row) =>
        row.user_id ? (
          <Link href={`/admin/traders/${row.user_id}`} className="block max-w-[14rem] truncate text-xs hover:text-amber-300">
            {profileById[row.user_id] ? nameOf(profileById[row.user_id]) : 'Unknown trader'}
          </Link>
        ) : (
          <span className="text-xs text-text-muted">Unlinked</span>
        ),
    },
    {
      key: 'created',
      header: 'Opened',
      cell: (row) => <span className="text-xs text-text-muted">{relativeTime(row.created_at)}</span>,
    },
  ];

  const paymentColumns: AdminColumn<Order>[] = [
    {
      key: 'payment',
      header: 'Payment',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{row.payment_id}</span>
          <StatusPill tone={orderStatusTone(row.status)}>{row.status}</StatusPill>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{row.payment_id}</p>
          <p className="text-[11px] text-text-muted">{relativeTime(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'trader',
      header: 'Trader',
      cell: (row) =>
        row.user_id ? (
          <Link href={`/admin/traders/${row.user_id}`} className="block max-w-[14rem] truncate text-xs hover:text-amber-300">
            {profileById[row.user_id] ? nameOf(profileById[row.user_id]) : 'Unknown trader'}
          </Link>
        ) : (
          <span className="text-xs text-text-muted">Unlinked</span>
        ),
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      cell: (row) => (
        <div className="min-w-[6rem]">
          <p>{usd.format(Number(row.amount_usd) || 0)}</p>
          <p className="text-[11px] text-text-muted">
            {row.crypto_currency ?? 'USDT'} on {row.network ?? 'TRC20'}
          </p>
        </div>
      ),
    },
    {
      key: 'expiry',
      header: 'Expires',
      cell: (row) => (
        <span className="text-xs text-text-muted">
          {row.expires_at ? (Date.parse(row.expires_at) < Date.now() ? 'past due' : relativeTime(row.expires_at)) : '—'}
        </span>
      ),
    },
  ];

  const queueCount = kycQueue.length + authoriseQueue.length + paymentQueue.length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Verification &amp; approval</h1>
          <p className="text-sm text-text-muted">
            Everything that needs a human decision before an account can trade or be paid out.
          </p>
        </div>
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
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not load the queues: {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding" value={queueCount} hint="Total decisions waiting" icon={ShieldCheck} tone={queueCount ? 'warn' : 'success'} />
        <StatCard label="Identity checks" value={kycQueue.length} hint="Unverified but trading" icon={UserCheck} tone={kycQueue.length ? 'warn' : 'neutral'} href="/admin/verify" />
        <StatCard label="Accounts to authorise" value={authoriseQueue.length} hint="No provisioning started" icon={BadgeCheck} tone={authoriseQueue.length ? 'warn' : 'neutral'} />
        <StatCard
          label="Awaiting MT5 setup"
          value={provisioningQueue.length}
          hint="Authorised, credentials not saved"
          icon={KeyRound}
          tone={provisioningQueue.length ? 'info' : 'neutral'}
          href="/admin/provision"
        />
      </div>

      <SectionCard
        title={`Identity checks (${kycQueue.length})`}
        description="Traders holding a paid order or challenge whose identity is not yet verified. Payouts are blocked until this is done."
      >
        <AdminTable
          rows={kycQueue}
          columns={kycColumns}
          getRowKey={(row) => row.id}
          loading={loading}
          empty={<p className="py-6 text-center text-xs text-text-muted">Every paying trader is verified. 🎉</p>}
          actions={(row) => (
            <>
              <AsyncButton variant="success" icon={BadgeCheck} onRun={() => setKyc(row.id, 'verified')}>
                Verify
              </AsyncButton>
              <AsyncButton variant="danger" icon={Ban} onRun={() => setKyc(row.id, 'rejected')}>
                Reject
              </AsyncButton>
              <Link href={`/admin/traders/${row.id}`} className={adminButtonClass('ghost', 'sm')}>
                <Eye className="h-3.5 w-3.5" />
                Profile
              </Link>
            </>
          )}
        />
      </SectionCard>

      <SectionCard
        title={`Accounts to authorise (${authoriseQueue.length})`}
        description="Authorising clears an account to trade and queues it for MT5 credential provisioning."
      >
        <AdminTable
          rows={authoriseQueue}
          columns={authoriseColumns}
          getRowKey={(row) => row.id}
          loading={loading}
          empty={<p className="py-6 text-center text-xs text-text-muted">Every live account has been authorised.</p>}
          actions={(row) => (
            <>
              <AsyncButton
                variant="primary"
                icon={BadgeCheck}
                title="Authorise this account and queue it for provisioning"
                onRun={() => authorise(row.id)}
              >
                Authorise
              </AsyncButton>
              <Link href={`/admin/challenges/${row.id}`} className={adminButtonClass('ghost', 'sm')}>
                <ExternalLink className="h-3.5 w-3.5" />
                Monitor
              </Link>
            </>
          )}
        />
      </SectionCard>

      <SectionCard
        title={`Payments awaiting review (${paymentQueue.length})`}
        description="Pending crypto orders. Verify on chain first, or mark paid if you have confirmed it elsewhere."
      >
        <AdminTable
          rows={paymentQueue}
          columns={paymentColumns}
          getRowKey={(row) => row.id}
          loading={loading}
          empty={<p className="py-6 text-center text-xs text-text-muted">No pending payments.</p>}
          actions={(row) => (
            <>
              <AsyncButton variant="primary" icon={Wallet} title="Re-check the chain" onRun={() => verifyChain(row.id)}>
                Verify chain
              </AsyncButton>
              <AsyncButton
                variant="success"
                icon={Check}
                title="Confirm manually and create the challenge"
                onRun={() => setOrderStatus(row.id, 'paid', 'Payment marked paid')}
              >
                Mark paid
              </AsyncButton>
              <ConfirmActionButton
                label="Cancel"
                confirmLabel="Confirm cancel"
                variant="danger"
                icon={Ban}
                onRun={() => setOrderStatus(row.id, 'cancelled', 'Order cancelled')}
              />
            </>
          )}
        />
      </SectionCard>
    </div>
  );
}
