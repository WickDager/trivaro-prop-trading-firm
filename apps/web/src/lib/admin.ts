/**
 * Shared helpers for the admin area.
 *
 * Everything here is a pure function or a thin fetch wrapper so it can be
 * imported from both client pages and server route handlers. Status → colour
 * mapping lives in exactly one place because the admin UI shows the same
 * statuses in a table, a detail header and a filter chip; three private copies
 * had already drifted (one of them painted 'failed' green).
 */

export const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const num = new Intl.NumberFormat('en-US');

/** `$45K`, `$1.2M` — for KPI tiles where the exact cents do not matter. */
export function usdCompact(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${Math.round(n / 1000)}K`;
  return usd.format(n);
}

export function pct(value: number | null | undefined, digits = 1): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
];

/** `3 days ago` / `in 2 hours`. Returns '—' for a missing or unparsable date. */
export function relativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '—';
  const diff = then - Date.now();
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'just now';
}

/** Seconds between two instants, or null when either side is missing. */
export function secondsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 1000));
}

export function formatSeconds(total: number | null): string {
  if (total == null) return '—';
  if (total < 60) return `${total}s`;
  if (total < 3600) return `${Math.round(total / 60)}m`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

// ---------------------------------------------------------------------------
// Status presentation
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-navy-500 text-text-secondary',
  info: 'bg-teal-500/10 text-teal-400',
  success: 'bg-green-500/10 text-green-400',
  warn: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-red-500/10 text-red-400',
};

/** Chip styles for the filter rows. Inactive chips are deliberately low
 *  contrast so a long status list stays readable. */
export const CHIP_ACTIVE = 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30';
export const CHIP_IDLE = 'bg-navy-800 text-text-muted hover:bg-navy-700 hover:text-white';

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CHALLENGE_STATUS_LABELS: Record<string, string> = {
  trial: 'Free Trial',
  // Set by the trial-expiry cron (migration 016).
  trial_expired: 'Trial Expired',
  active: 'Phase 1',
  phase1_complete: 'Phase 2',
  phase2_complete: 'Phase 2 passed',
  passed: 'Passed',
  funded: 'Funded',
  reviewing: 'Under Review',
  failed: 'Failed',
};

export function challengeStatusLabel(status: string): string {
  return CHALLENGE_STATUS_LABELS[status] ?? titleCase(status);
}

export function challengeStatusTone(status: string): Tone {
  switch (status) {
    case 'funded':
      return 'success';
    case 'active':
      return 'info';
    case 'trial':
      return 'warn';
    case 'trial_expired':
      return 'neutral';
    case 'failed':
      return 'danger';
    case 'reviewing':
      return 'warn';
    default:
      return 'neutral';
  }
}

/** Every status a challenge can hold (001 + 012 + 014 + 016 constraints). */
export const CHALLENGE_STATUSES = [
  'trial',
  'trial_expired',
  'active',
  'phase1_complete',
  'phase2_complete',
  'reviewing',
  'funded',
  'passed',
  'failed',
] as const;

export function orderStatusTone(status: string): Tone {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warn';
    case 'refunded':
      return 'info';
    case 'expired':
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const ORDER_STATUSES = ['pending', 'paid', 'expired', 'failed', 'refunded', 'cancelled'] as const;

export function credentialStatusTone(status: string | null): Tone {
  switch (status) {
    case 'sent':
      return 'success';
    case 'provisioned':
      return 'info';
    case 'pending':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function credentialStatusLabel(status: string | null): string {
  switch (status) {
    case 'sent':
      return 'Delivered';
    case 'provisioned':
      return 'Ready to deliver';
    case 'pending':
      return 'Awaiting credentials';
    case 'none':
    case null:
    case undefined:
      return 'Not required';
    default:
      return titleCase(status);
  }
}

export function kycTone(status: string | null): Tone {
  switch (status) {
    case 'verified':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'pending':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function kycLabel(status: string | null): string {
  return status ? titleCase(status) : 'Not submitted';
}

export function roleTone(role: string): Tone {
  return role === 'admin' ? 'warn' : role === 'reviewer' ? 'info' : 'neutral';
}

// ---------------------------------------------------------------------------
// Monitoring maths
// ---------------------------------------------------------------------------

/** The subset of `challenges` the monitoring views need. */
export interface MonitoredChallenge {
  id: string;
  status: string;
  starting_balance: number | null;
  current_equity: number | null;
  highest_equity: number | null;
  daily_peak_equity: number | null;
  daily_peak_date: string | null;
  phase_start_equity: number | null;
  profit_target: number | null;
  max_drawdown: number | null;
  daily_drawdown: number | null;
  trading_days: number | null;
  min_trading_days: number | null;
  last_trade_date: string | null;
  is_trial?: boolean;
}

export interface ChallengeHealth {
  /** Equity as a percentage gain (or loss) since the current phase began. */
  profitPct: number;
  /** 0–100+ : how far along the profit target the account is. */
  targetPct: number;
  /** Percentage already given back from the peak equity. */
  totalDrawdownPct: number;
  /** Percentage of the total-loss allowance consumed. */
  totalLossUsedPct: number;
  /** Percentage of today's loss allowance consumed, or null before today's
   *  first trade — the daily peak is only meaningful for the current day. */
  dailyLossUsedPct: number | null;
  daysPct: number;
  phaseLabel: string;
  /** 'breach' = past a hard limit, 'watch' = within 25% of one or idle,
   *  'ok' = healthy. Drives the monitoring row highlight. */
  health: 'ok' | 'watch' | 'breach';
  idleDays: number | null;
}

function ratio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

export function challengeHealth(c: MonitoredChallenge): ChallengeHealth {
  const start = Number(c.starting_balance) || 0;
  const phaseStart = Number(c.phase_start_equity) || start;
  const equity = Number(c.current_equity ?? phaseStart);
  const peak = Math.max(Number(c.highest_equity) || equity, equity);

  const profitPct = ratio(equity - phaseStart, phaseStart);
  const targetPct = ratio(profitPct, Number(c.profit_target) || 8);
  const totalDrawdownPct = ratio(peak - equity, peak);
  const totalLossUsedPct = ratio(totalDrawdownPct, Number(c.max_drawdown) || 5);

  const peakIsToday = c.daily_peak_date === new Date().toISOString().slice(0, 10);
  const dailyPeak = Number(c.daily_peak_equity) || 0;
  const dailyLossUsedPct =
    peakIsToday && dailyPeak > 0 ? ratio(dailyPeak - equity, dailyPeak) / (Number(c.daily_drawdown) || 3) * 100 : null;

  const daysPct = ratio(Number(c.trading_days) || 0, Number(c.min_trading_days) || 5);

  const idleDays = c.last_trade_date
    ? Math.floor((Date.now() - Date.parse(`${c.last_trade_date}T00:00:00Z`)) / 86_400_000)
    : null;

  let health: ChallengeHealth['health'] = 'ok';
  const activeStatuses = ['active', 'trial', 'phase1_complete', 'phase2_complete', 'funded'];
  if (activeStatuses.includes(c.status)) {
    if (totalLossUsedPct >= 100 || (dailyLossUsedPct !== null && dailyLossUsedPct >= 100)) {
      health = 'breach';
    } else if (totalLossUsedPct >= 75 || (dailyLossUsedPct !== null && dailyLossUsedPct >= 75)) {
      health = 'watch';
    } else if (idleDays !== null && idleDays >= 7) {
      health = 'watch';
    }
  }

  return {
    profitPct,
    targetPct,
    totalDrawdownPct,
    totalLossUsedPct,
    dailyLossUsedPct,
    daysPct,
    phaseLabel: challengeStatusLabel(c.status),
    health,
    idleDays,
  };
}

// ---------------------------------------------------------------------------
// Privileged writes
// ---------------------------------------------------------------------------

export interface AdminActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  hint?: string;
  data?: T;
}

/**
 * Every privileged write goes through /api/admin/actions so the server can
 * re-check the admin role, validate the payload, and append the
 * `admin_audit_log` row that the Overview dashboard reads. A browser-side
 * write would satisfy RLS for some of these tables but would leave no trail.
 */
export async function adminAction<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<AdminActionResult<T>> {
  try {
    const res = await fetch('/api/admin/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: typeof body.error === 'string' ? body.error : `Request failed (${res.status})`,
        hint: typeof body.hint === 'string' ? body.hint : undefined,
      };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/** Client-side CSV export — admins ask for spreadsheets far more often than
 *  for a JSON API, and this keeps exports out of the server entirely. */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const escape = (cell: string | number | null | undefined) => {
    if (cell === null || cell === undefined) return '';
    const s = String(cell);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n');
  // The BOM keeps Excel from mangling the em dashes and × signs in labels.
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
}
