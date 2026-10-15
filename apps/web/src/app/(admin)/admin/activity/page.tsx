'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminTable, Pagination, type AdminColumn } from '@/components/admin/Table';
import { FilterChips, SectionCard, StatusPill } from '@/components/admin/Primitives';
import { AsyncButton, adminButtonClass } from '@/components/admin/Actions';
import { adminAction, downloadCsv, formatDateTime, relativeTime } from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import { Download, History, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

interface AuditRow {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface NotificationRow {
  id: string;
  challenge_id: string;
  user_id: string;
  type: string;
  status: string;
  recipient_email: string;
  subject: string;
  rule_violated: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface CredentialRow {
  id: string;
  challenge_id: string;
  action: string;
  acted_by: string | null;
  acted_at: string;
  note: string | null;
}

const TABS = ['audit', 'credentials', 'emails'] as const;
const PAGE_SIZE = 50;

type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  audit: 'Admin actions',
  credentials: 'Credential changes',
  emails: 'Emails',
};

function describeDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const parts = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  return parts.length ? parts.join(' · ') : '—';
}

export default function AdminActivityPage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [credentialTotal, setCredentialTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async (which: Tab, currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const resource = which === 'audit' ? 'audit' : which === 'emails' ? 'notifications' : 'credential_audit';
      const res = await fetch(
        `/api/admin/data?resource=${resource}&limit=${PAGE_SIZE}&offset=${currentPage * PAGE_SIZE}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setError(`Could not load ${TAB_LABELS[which].toLowerCase()} (HTTP ${res.status}).`);
        return;
      }
      const body = (await res.json()) as {
        rows?: unknown[];
        total?: number;
      };
      const rows = body.rows ?? [];
      if (which === 'audit') {
        setAudit(rows as AuditRow[]);
        setAuditTotal(body.total ?? rows.length);
      } else if (which === 'emails') {
        setNotifications(rows as NotificationRow[]);
        setNotificationTotal(body.total ?? rows.length);
      } else {
        setCredentials(rows as CredentialRow[]);
        setCredentialTotal(body.total ?? rows.length);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab, page);
  }, [load, tab, page]);

  async function retry(notificationId: string) {
    const result = await adminAction('notification_retry', { notification_id: notificationId });
    if (!result.ok) return result;
    toast.success('Email re-sent');
    setNotifications((prev) =>
      prev.map((row) => (row.id === notificationId ? { ...row, status: 'sent', error_message: null } : row)),
    );
    return result;
  }

  function exportCsv() {
    if (tab === 'audit') {
      downloadCsv('trivaro-admin-audit.csv', [
        ['When', 'Action', 'Target type', 'Target id', 'Details', 'IP'],
        ...audit.map((row) => [
          row.created_at,
          row.action,
          row.target_type,
          row.target_id,
          describeDetails(row.details),
          row.ip_address,
        ]),
      ]);
      return;
    }
    if (tab === 'emails') {
      downloadCsv('trivaro-emails.csv', [
        ['When', 'Type', 'Recipient', 'Subject', 'Status', 'Rule', 'Error'],
        ...notifications.map((row) => [
          row.created_at,
          row.type,
          row.recipient_email,
          row.subject,
          row.status,
          row.rule_violated,
          row.error_message,
        ]),
      ]);
      return;
    }
    downloadCsv('trivaro-credential-audit.csv', [
      ['When', 'Challenge', 'Action', 'Note'],
      ...credentials.map((row) => [row.acted_at, row.challenge_id, row.action, row.note]),
    ]);
  }

  const auditColumns: AdminColumn<AuditRow>[] = [
    {
      key: 'when',
      header: 'When',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="warn">{row.action.replace(/_/g, ' ')}</StatusPill>
          <span className="text-[11px] text-text-muted">{formatDateTime(row.created_at)}</span>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-xs">{formatDateTime(row.created_at)}</p>
          <p className="text-[11px] text-text-muted">{relativeTime(row.created_at)}</p>
        </div>
      ),
    },
    { key: 'action', header: 'Action', cell: (row) => <StatusPill tone="warn">{row.action.replace(/_/g, ' ')}</StatusPill> },
    {
      key: 'target',
      header: 'Target',
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-xs">{row.target_type}</p>
          <code className="block truncate text-[11px] text-text-muted">{row.target_id}</code>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      desktopOnly: true,
      cell: (row) => <span className="text-[11px] text-text-muted">{describeDetails(row.details)}</span>,
    },
    {
      key: 'ip',
      header: 'IP',
      desktopOnly: true,
      cell: (row) => <span className="text-[11px] text-text-muted">{row.ip_address ?? '—'}</span>,
    },
  ];

  const notificationColumns: AdminColumn<NotificationRow>[] = [
    {
      key: 'subject',
      header: 'Email',
      primary: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{row.subject}</p>
          <p className="truncate text-[11px] text-text-muted">
            {row.type.replace(/_/g, ' ')} → {row.recipient_email}
          </p>
        </div>
      ),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-xs">{row.subject}</p>
          <p className="truncate text-[11px] text-text-muted">{row.recipient_email}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', cell: (row) => <span className="text-xs">{row.type.replace(/_/g, ' ')}</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill tone={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'danger' : 'warn'}>
          {row.status}
        </StatusPill>
      ),
    },
    {
      key: 'rule',
      header: 'Rule',
      desktopOnly: true,
      cell: (row) => <span className="text-[11px] text-text-muted">{row.rule_violated ?? '—'}</span>,
    },
    {
      key: 'when',
      header: 'Queued',
      cell: (row) => <span className="text-xs text-text-muted">{relativeTime(row.created_at)}</span>,
    },
  ];

  const credentialColumns: AdminColumn<CredentialRow>[] = [
    {
      key: 'when',
      header: 'When',
      primary: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone="info">{row.action}</StatusPill>
          <span className="text-[11px] text-text-muted">{formatDateTime(row.acted_at)}</span>
        </div>
      ),
      cell: (row) => <span className="text-xs">{formatDateTime(row.acted_at)}</span>,
    },
    { key: 'action', header: 'Action', cell: (row) => <StatusPill tone="info">{row.action}</StatusPill> },
    {
      key: 'challenge',
      header: 'Account',
      cell: (row) => (
        <Link href={`/admin/challenges/${row.challenge_id}`} className="font-mono text-[11px] hover:text-amber-300">
          {row.challenge_id.slice(0, 8)}
        </Link>
      ),
    },
    { key: 'note', header: 'Note', cell: (row) => <span className="text-[11px] text-text-muted">{row.note ?? '—'}</span> },
  ];

  const totals: Record<Tab, number> = {
    audit: auditTotal,
    credentials: credentialTotal,
    emails: notificationTotal,
  };
  const pageCount = Math.max(1, Math.ceil(totals[tab] / PAGE_SIZE));

  const filteredAudit = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return audit;
    return audit.filter(
      (row) =>
        row.action.toLowerCase().includes(needle) ||
        row.target_type.toLowerCase().includes(needle) ||
        row.target_id.toLowerCase().includes(needle),
    );
  }, [audit, search]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Activity</h1>
          <p className="text-sm text-text-muted">
            The audit trail: who changed what, which emails went out, and every credential action.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={adminButtonClass('secondary')} onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" />
            Export page
          </button>
          <button
            type="button"
            className={adminButtonClass('secondary')}
            onClick={() => void load(tab, page)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          ariaLabel="Choose a log"
          options={TABS}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(0);
            setSearch('');
          }}
          labels={TAB_LABELS}
          counts={totals}
        />
        {tab === 'audit' && (
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter this page…"
            aria-label="Filter audit rows"
            className="w-full max-w-xs rounded-lg border border-amber-500/10 bg-navy-800 px-3 py-2 text-sm placeholder:text-text-muted focus:border-amber-400/40 focus:outline-none"
          />
        )}
      </div>

      {tab === 'audit' && (
        <SectionCard
          title="Admin actions"
          description="Written by the admin API on every privileged change. Append-only."
        >
          <AdminTable
            rows={filteredAudit}
            columns={auditColumns}
            getRowKey={(row) => row.id}
            loading={loading}
            empty={
              <p className="py-6 text-center text-xs text-text-muted">
                No admin actions recorded yet — approving a payment or verifying a trader writes the first row.
              </p>
            }
            footer={<Pagination page={page} pageCount={pageCount} total={auditTotal} onPage={setPage} />}
          />
        </SectionCard>
      )}

      {tab === 'credentials' && (
        <SectionCard
          title="Credential changes"
          description="Provisioning, rotation, requeue and delivery — passwords are stored only as a hash."
        >
          <AdminTable
            rows={credentials}
            columns={credentialColumns}
            getRowKey={(row) => row.id}
            loading={loading}
            empty={<p className="py-6 text-center text-xs text-text-muted">No credential actions recorded.</p>}
            footer={<Pagination page={page} pageCount={pageCount} total={credentialTotal} onPage={setPage} />}
          />
        </SectionCard>
      )}

      {tab === 'emails' && (
        <SectionCard
          title="Emails"
          description="Rule notifications queued by the risk engine. A failed send can be retried here."
        >
          <AdminTable
            rows={notifications}
            columns={notificationColumns}
            getRowKey={(row) => row.id}
            loading={loading}
            empty={<p className="py-6 text-center text-xs text-text-muted">No notifications have been queued.</p>}
            actions={(row) =>
              row.status === 'failed' || row.status === 'pending' ? (
                <AsyncButton
                  variant="primary"
                  icon={Mail}
                  title="Replay this notification through the send-notification function"
                  onRun={() => retry(row.id)}
                >
                  Retry
                </AsyncButton>
              ) : null
            }
            footer={<Pagination page={page} pageCount={pageCount} total={notificationTotal} onPage={setPage} />}
          />
        </SectionCard>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <History className="h-3.5 w-3.5" />
        {totals[tab]} {TAB_LABELS[tab].toLowerCase()} recorded.
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Audit rows cannot be edited or deleted.
        </span>
      </div>
    </div>
  );
}
