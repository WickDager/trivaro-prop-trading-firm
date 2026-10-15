'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { AdminTable, type AdminColumn } from '@/components/admin/Table';
import { SectionCard, StatCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, ConfirmActionButton, adminButtonClass } from '@/components/admin/Actions';
import {
  adminAction, challengeStatusLabel, challengeStatusTone, formatDate, relativeTime, usdCompact,
} from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import { Award, BadgeCheck, Download, ExternalLink, RefreshCw, ShieldOff } from 'lucide-react';

interface Certificate {
  id: string;
  user_id: string;
  challenge_id: string;
  certificate_number: string;
  trader_name: string;
  account_size: number;
  completion_date: string;
  status: string;
  revoked_at: string | null;
  created_at: string;
}

interface Challenge {
  id: string;
  user_id: string | null;
  account_number: string | null;
  status: string;
  is_trial: boolean;
  starting_balance: number;
  created_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
}

/** Mirrors the set the certificate API accepts. */
const CERTIFIABLE = new Set(['passed', 'phase2_complete', 'funded']);

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const supabase = createBrowserClient();
    const [certsRes, challengesRes, profilesRes] = await Promise.all([
      supabase
        .from('certificates')
        .select('id,user_id,challenge_id,certificate_number,trader_name,account_size,completion_date,status,revoked_at,created_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('challenges')
        .select('id,user_id,account_number,status,is_trial,starting_balance,created_at')
        .in('status', [...CERTIFIABLE])
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('profiles').select('id,email,full_name').limit(1000),
    ]);

    if (certsRes.error) {
      setError(certsRes.error.message);
      setLoading(false);
      return;
    }

    setCertificates((certsRes.data as Certificate[] | null) ?? []);
    setChallenges((challengesRes.data as Challenge[] | null) ?? []);
    const map: Record<string, Profile> = {};
    for (const profile of (profilesRes.data as Profile[] | null) ?? []) map[profile.id] = profile;
    setProfiles(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const issuedByChallenge = useMemo(() => {
    const map = new Map<string, Certificate>();
    for (const certificate of certificates) map.set(certificate.challenge_id, certificate);
    return map;
  }, [certificates]);

  const eligible = useMemo(
    () => challenges.filter((challenge) => !challenge.is_trial && !issuedByChallenge.has(challenge.id)),
    [challenges, issuedByChallenge],
  );

  const active = certificates.filter((certificate) => certificate.status !== 'revoked');

  async function issue(challengeId: string) {
    setBusy(challengeId);
    try {
      const result = await adminAction('certificate_issue', { challenge_id: challengeId });
      if (!result.ok) return result;
      toast.success('Certificate issued — the trader can download it from their dashboard');
      await load();
      return result;
    } finally {
      setBusy(null);
    }
  }

  async function revoke(certificateId: string) {
    setBusy(certificateId);
    try {
      const result = await adminAction('certificate_revoke', { certificate_id: certificateId });
      if (!result.ok) return result;
      toast.success('Certificate revoked');
      setCertificates((prev) =>
        prev.map((row) =>
          row.id === certificateId ? { ...row, status: 'revoked', revoked_at: new Date().toISOString() } : row,
        ),
      );
      return result;
    } finally {
      setBusy(null);
    }
  }

  async function download(certificate: Certificate) {
    setBusy(certificate.id);
    try {
      const res = await fetch('/api/certificate/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: certificate.challenge_id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? 'Could not generate the certificate PDF');
        return { ok: false, error: body.error ?? 'PDF generation failed' };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trivaro-certificate-${certificate.certificate_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return { ok: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Download failed';
      toast.error(message);
      return { ok: false, error: message };
    } finally {
      setBusy(null);
    }
  }

  const issuedColumns: AdminColumn<Certificate>[] = [
    {
      key: 'number',
      header: 'Certificate',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs">{row.certificate_number}</span>
          <StatusPill tone={row.status === 'revoked' ? 'danger' : 'success'}>{row.status}</StatusPill>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs">{row.certificate_number}</p>
          <p className="text-[11px] text-text-muted">{formatDate(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: 'trader',
      header: 'Trader',
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/admin/traders/${row.user_id}`} className="block max-w-[14rem] truncate text-xs hover:text-amber-300">
            {row.trader_name}
          </Link>
          <p className="truncate text-[11px] text-text-muted">{profiles[row.user_id]?.email ?? ''}</p>
        </div>
      ),
    },
    { key: 'size', header: 'Account', numeric: true, cell: (row) => usdCompact(row.account_size) },
    {
      key: 'completion',
      header: 'Completed',
      cell: (row) => <span className="text-xs text-text-muted">{formatDate(row.completion_date)}</span>,
    },
    {
      key: 'account',
      header: 'Account',
      desktopOnly: true,
      cell: (row) => (
        <Link href={`/admin/challenges/${row.challenge_id}`} className="font-mono text-[11px] hover:text-amber-300">
          {challenges.find((c) => c.id === row.challenge_id)?.account_number ?? row.challenge_id.slice(0, 8)}
        </Link>
      ),
    },
  ];

  const eligibleColumns: AdminColumn<Challenge>[] = [
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
          <p className="text-[11px] text-text-muted">{usdCompact(row.starting_balance)}</p>
        </div>
      ),
    },
    {
      key: 'trader',
      header: 'Trader',
      cell: (row) => (
        <Link href={`/admin/traders/${row.user_id}`} className="block max-w-[14rem] truncate text-xs hover:text-amber-300">
          {profiles[row.user_id ?? '']?.full_name ?? profiles[row.user_id ?? '']?.email ?? 'Unknown trader'}
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Result',
      cell: (row) => <StatusPill tone={challengeStatusTone(row.status)}>{challengeStatusLabel(row.status)}</StatusPill>,
    },
    {
      key: 'found',
      header: 'Qualified',
      cell: (row) => <span className="text-xs text-text-muted">{relativeTime(row.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Certificates</h1>
          <p className="text-sm text-text-muted">
            Certificates are issued for passed and funded accounts. The trader downloads theirs from the dashboard.
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
          Could not load certificates: {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Issued" value={active.length} hint="Live certificates in circulation" icon={Award} tone="success" />
        <StatCard label="Awaiting issue" value={eligible.length} hint="Passed accounts with no certificate yet" icon={BadgeCheck} tone={eligible.length ? 'warn' : 'neutral'} />
        <StatCard
          label="Revoked"
          value={certificates.length - active.length}
          hint="Withdrawn after issue"
          icon={ShieldOff}
          tone="neutral"
        />
      </div>

      <SectionCard
        title={`Awaiting issue (${eligible.length})`}
        description="Passed or funded accounts that do not have a certificate yet."
      >
        <AdminTable
          rows={eligible}
          columns={eligibleColumns}
          getRowKey={(row) => row.id}
          loading={loading}
          empty={<p className="py-6 text-center text-xs text-text-muted">Every passed account has a certificate.</p>}
          actions={(row) => (
            <>
              <AsyncButton
                variant="primary"
                icon={Award}
                disabled={busy === row.id}
                onRun={() => issue(row.id)}
              >
                Issue
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
        title={`Issued certificates (${certificates.length})`}
        description="Download a copy for support requests, or revoke a certificate that should never have been issued."
      >
        <AdminTable
          rows={certificates}
          columns={issuedColumns}
          getRowKey={(row) => row.id}
          loading={loading}
          empty={<p className="py-6 text-center text-xs text-text-muted">No certificates issued yet.</p>}
          actions={(row) => (
            <>
              <AsyncButton
                variant="secondary"
                icon={Download}
                disabled={busy === row.id}
                title="Generate and download the PDF"
                onRun={() => download(row)}
              >
                PDF
              </AsyncButton>
              {row.status !== 'revoked' && (
                <ConfirmActionButton
                  label="Revoke"
                  confirmLabel="Confirm revoke"
                  variant="danger"
                  icon={ShieldOff}
                  title="Mark this certificate as revoked"
                  onRun={() => revoke(row.id)}
                />
              )}
            </>
          )}
        />
      </SectionCard>
    </div>
  );
}
