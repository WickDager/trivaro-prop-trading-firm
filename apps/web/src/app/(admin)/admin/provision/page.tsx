'use client';

// ============================================================================
// /admin/provision — human-in-the-loop MT5 credential provisioning queue.
//
// Admin-only. The user NEVER sees this page (separate UI, separate privileges
// — enforced here by the admin layout AND again by /api/admin/credentials on
// every write).
//
// Flow:
//   1. Lists every challenge where credential_status = 'pending'
//      (i.e. paid order or new trial awaiting real broker credentials).
//   2. Admin provisions from their MT5 Manager / broker dashboard:
//        account_number (TV-XXXXXX), server, REAL investor/master password.
//      On submit → set_challenge_credentials() writes the DB + audit row, and
//      credential_status becomes 'provisioned'.
//   3. To deliver to the customer, the admin triggers /admin/deliver (or the
//      send-credentials URL as described in its doc header).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/components/ui/toast';
import { GradientText } from '@/components/shared/GradientText';
import { AsyncButton, adminButtonClass } from '@/components/admin/Actions';
import { FilterChips, StatCard, StatusPill } from '@/components/admin/Primitives';
import { adminAction, credentialStatusLabel, credentialStatusTone, relativeTime, usdCompact } from '@/lib/admin';
import { Eye, KeyRound, Loader2, RefreshCw, Send, ShieldCheck } from 'lucide-react';

interface PendingRow {
  id: string;
  account_number: string | null;
  starting_balance: number;
  status: string;
  is_trial: boolean;
  created_at: string;
  user_id: string | null;
  /** 'pending' = awaiting real credentials; 'provisioned' = saved but not
   *  delivered — kept in the queue so it can be requeued if the broker rejects it. */
  credential_status: string;
}

interface ProfileMap { [id: string]: { email?: string; first_name?: string; last_name?: string } }

export default function AdminProvisionPage() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** 'all' | 'pending' | 'provisioned' — the two stages of the same job. */
  const [stage, setStage] = useState<'all' | 'pending' | 'provisioned'>('all');

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Sign in required.');
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile || profile.role !== 'admin') {
      setError('Admin access required.');
      setLoading(false);
      return;
    }

    // Queue = challenges awaiting real credentials ('pending') plus ones whose
    // credentials were saved but not yet delivered ('provisioned'), so an admin
    // can requeue a row the broker rejected. 'sent' rows drop out.
    const { data: queue, error: queueError } = await supabase
      .from('challenges')
      .select('id,account_number,starting_balance,status,is_trial,created_at,user_id,credential_status')
      .in('credential_status', ['pending', 'provisioned'])
      .order('created_at', { ascending: true });

    if (queueError) {
      setError(queueError.message);
      setLoading(false);
      return;
    }
    setRows((queue as unknown as PendingRow[]) ?? []);

    // Customer emails for display — no secrets here.
    const ids = Array.from(new Set(((queue as unknown as PendingRow[]) ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    if (ids.length > 0) {
      const { data: profData } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name')
        .in('id', ids);
      const map: ProfileMap = {};
      for (const p of (profData ?? []) as { id: string; email?: string; first_name?: string; last_name?: string }[]) {
        map[p.id] = { email: p.email, first_name: p.first_name, last_name: p.last_name };
      }
      setProfiles(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function provision(
    challengeId: string,
    accountNumber: string,
    accountPassword: string,
    server: string,
    note: string | null,
  ) {
    setBusy(challengeId);
    setError(null);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challengeId,
          account_number: accountNumber,
          account_password: accountPassword,
          server,
          note,
          action: 'provision',
        }),
      });
      const data = await res.json() as { error?: string; hint?: string };
      if (!res.ok) {
        setMessage(data.hint
          ? `${data.error}: ${data.hint}`
          : data.error || 'Provisioning failed.');
        return;
      }
      toast.success('Credentials saved. Now deliver them to the customer.');
      setExpanded((id) => (id === challengeId ? null : id));
      await load();
    } catch {
      setMessage('Network error — check your connection and retry.');
    } finally {
      setBusy(null);
    }
  }

  /** Hand the saved credentials to the trader via the send-credentials edge
   *  function, which also flips credential_status to 'sent'. */
  async function deliver(challengeId: string) {
    setBusy(challengeId);
    try {
      const result = await adminAction('credentials_send', { challenge_id: challengeId });
      if (!result.ok) {
        setMessage(result.hint ? `${result.error}: ${result.hint}` : result.error ?? 'Delivery failed.');
        return;
      }
      toast.success('Credentials delivered to the trader');
      setMessage(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function requeue(challengeId: string) {
    setBusy(challengeId);
    try {
      const res = await fetch('/api/admin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, action: 'requeue' }),
      });
      if (!res.ok) {
        setMessage('Could not requeue.');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold">
          <GradientText as="span">Credential</GradientText> Provisioning
        </h1>
        <p className="text-sm text-text-muted">
          Real MT5 accounts only — from MT5 Manager or your broker. Credentials are
          audit-logged; the customer is emailed after the credentials pass review.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="In queue"
          value={rows.length}
          hint="Awaiting credentials or delivery"
          icon={ShieldCheck}
          tone={rows.length ? 'warn' : 'success'}
        />
        <StatCard
          label="Awaiting MT5 setup"
          value={rows.filter((row) => row.credential_status === 'pending').length}
          hint="Need a real broker login"
          icon={KeyRound}
          tone="info"
        />
        <StatCard
          label="Ready to deliver"
          value={rows.filter((row) => row.credential_status === 'provisioned').length}
          hint="Saved, not yet sent to the trader"
          icon={Send}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          ariaLabel="Filter the provisioning queue"
          options={['all', 'pending', 'provisioned'] as const}
          value={stage}
          onChange={setStage}
          labels={{ all: 'Everything', pending: 'Needs MT5', provisioned: 'Ready to send' }}
          counts={{
            all: rows.length,
            pending: rows.filter((row) => row.credential_status === 'pending').length,
            provisioned: rows.filter((row) => row.credential_status === 'provisioned').length,
          }}
        />
        <button
          type="button"
          onClick={() => { setLoading(true); void load(); }}
          className="inline-flex items-center gap-2 rounded-lg bg-navy-800 px-3 py-2 text-xs font-medium text-text-muted hover:text-white"
          aria-label="Refresh queue"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teal-400" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8 text-center text-sm text-text-muted">
          Nothing awaiting provisioning. Authorise an account, or accept a payment, and it appears here.
        </div>
      ) : (
        <div className="space-y-3">
          {rows
            .filter((row) => stage === 'all' || row.credential_status === stage)
            .map((row) => (
            <div key={row.id} className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">
                      {row.is_trial ? 'Free Trial' : `${usdCompact(row.starting_balance)} challenge`}
                    </p>
                    <StatusPill tone={credentialStatusTone(row.credential_status)}>
                      {credentialStatusLabel(row.credential_status)}
                    </StatusPill>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                    id: {row.id.slice(0, 8)} · status: {row.status} · opened {relativeTime(row.created_at)}
                  </p>
                  <p className="text-xs text-text-muted">
                    Customer:{' '}
                    {row.user_id ? (
                      <Link href={`/admin/traders/${row.user_id}`} className="hover:text-amber-300">
                        {profiles[row.user_id]?.email ?? 'open profile'}
                      </Link>
                    ) : (
                      '(unknown)'
                    )}
                  </p>
                </div>
                {/* `flex-wrap` + `shrink-0` buttons: four controls on one row
                    used to overlap on narrow phones. */}
                <div className="flex flex-wrap items-center gap-2">
                  {row.credential_status === 'provisioned' && (
                    <AsyncButton
                      variant="success"
                      icon={Send}
                      title="Send the MT5 login to the trader via the Telegram bot"
                      disabled={busy === row.id}
                      onRun={() => deliver(row.id)}
                    >
                      Deliver
                    </AsyncButton>
                  )}
                  {row.credential_status === 'provisioned' && (
                    <button
                      type="button"
                      disabled={busy === row.id}
                      onClick={() => void requeue(row.id)}
                      title="Send this challenge back to the pending queue if the broker rejected it"
                      className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      Requeue
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    className="rounded-lg bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-300 hover:bg-teal-500/20"
                  >
                    {expanded === row.id ? 'Cancel' : 'Provision…'}
                  </button>
                  <Link href={`/admin/challenges/${row.id}`} className={adminButtonClass('ghost', 'sm')}>
                    <Eye className="h-3.5 w-3.5" />
                    Monitor
                  </Link>
                </div>
              </div>

              {expanded === row.id && (
                <ProvisionForm
                  defaultAccountNumber={row.is_trial ? '' : (row.account_number ?? '')}
                  busy={busy === row.id}
                  onSubmit={(acc, pw, srv, note) => void provision(row.id, acc, pw, srv, note)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProvisionForm(props: {
  busy: boolean;
  defaultAccountNumber: string;
  onSubmit: (account: string, password: string, server: string, note: string | null) => void;
}) {
  const [account, setAccount] = useState(props.defaultAccountNumber);
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [note, setNote] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="mt-3 space-y-2 border-t border-teal-500/10 pt-3">
      <label className="block text-xs text-text-muted">
        MT5 Login (from broker / MT5 Manager)
        <input
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          autoComplete="off"
          className="mt-1 block w-full rounded-lg bg-navy-800 px-3 py-2 text-sm text-white"
          placeholder="TV-XXXXXX"
        />
      </label>
      <label className="block text-xs text-text-muted">
        MT5 Investor (read-only) Password
        <input
          value={password}
          type={show ? 'text' : 'password'}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          className="mt-1 block w-full rounded-lg bg-navy-800 px-3 py-2 text-sm text-white"
          placeholder="read-only password"
        />
      </label>
      <label className="block text-xs text-text-muted">
        Broker Server
        <input
          value={server}
          onChange={(e) => setServer(e.target.value)}
          autoComplete="off"
          className="mt-1 block w-full rounded-lg bg-navy-800 px-3 py-2 text-sm text-white"
          placeholder="e.g. ICMarkets-Demo"
        />
      </label>
      <label className="block text-xs text-text-muted">
        Note (optional)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 block w-full rounded-lg bg-navy-800 px-3 py-2 text-sm text-white"
        />
      </label>
      <p className="text-[11px] text-text-muted bg-navy-800/40 px-2 py-1.5 rounded">
        The broker password is stored server-side only and never shown in the
        response body. Auto-refresh tokens are disabled for this client.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={props.busy || !account || !password || !server}
          onClick={() => props.onSubmit(account, password, server, note || null)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-300 disabled:opacity-50"
        >
          {props.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Save & mark provisioned
        </button>
        <button
          type="button"
          disabled={props.busy}
          onClick={() => setShow((s) => !s)}
          className="rounded-lg bg-navy-800 px-3 py-2 text-xs text-text-muted"
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
