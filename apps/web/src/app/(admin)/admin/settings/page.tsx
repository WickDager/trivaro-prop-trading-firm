'use client';

import { useCallback, useEffect, useState } from 'react';
import { SectionCard, StatusPill, StatCard } from '@/components/admin/Primitives';
import { AsyncButton, adminButtonClass } from '@/components/admin/Actions';
import { adminAction, formatDateTime, usd, usdCompact } from '@/lib/admin';
import { toast } from '@/components/ui/toast';
import {
  AlertTriangle, Check, CreditCard, KeyRound, RefreshCw, Save, Settings, Wallet, X,
} from 'lucide-react';

interface ConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

interface PriceRow {
  account_size: number;
  challenge_type: string;
  price_usd: number;
}

interface SystemPayload {
  config: ConfigRow[];
  prices: PriceRow[];
  services: Record<string, boolean>;
}

/** Kept in step with the server-side allow-list in /api/admin/actions. */
const WALLET_FIELDS: { key: string; label: string; hint: string; pattern: RegExp; placeholder: string }[] = [
  {
    key: 'hot_wallet_trc20',
    label: 'USDT deposit address — Tron (TRC20)',
    hint: 'Base58 address starting with T.',
    pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    placeholder: 'T…',
  },
  {
    key: 'hot_wallet_erc20',
    label: 'USDC deposit address — Ethereum (ERC20)',
    hint: '0x followed by 40 hex characters. The verifier scans this address for the USDC contract below and nothing else.',
    pattern: /^0x[0-9a-fA-F]{40}$/,
    placeholder: '0x…',
  },
  {
    key: 'hot_wallet_btc',
    label: 'Bitcoin deposit address',
    hint: 'Legacy (1…), P2SH (3…) or bech32 (bc1…).',
    pattern: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
    placeholder: 'bc1…',
  },
  {
    key: 'usdt_trc20_contract',
    label: 'USDT TRC20 contract the verifier pins',
    hint: 'Only change this if Tether redeploys the token.',
    pattern: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
    placeholder: 'T…',
  },
  {
    key: 'usdc_erc20_contract',
    label: 'USDC ERC20 contract the verifier pins',
    hint: "Circle's USDC on Ethereum. Only change it if Circle redeploys the token.",
    pattern: /^0x[0-9a-fA-F]{40}$/,
    placeholder: '0x…',
  },
];

const SERVICE_LABELS: Record<string, string> = {
  supabase_secret_key: 'Supabase secret key (admin writes)',
  edge_function_api_key: 'Edge function key (verifiers, delivery)',
  trongrid_api_key: 'TronGrid API key (optional — raises TRC20 rate limits)',
  etherscan_api_key: 'Etherscan API key (optional — preferred over the keyless USDC mirrors)',
  cron_secret: 'Cron secret (guards the BTC price refresh)',
  resend_api_key: 'Resend API key (rule emails)',
  telegram_bot_token: 'Telegram bot token (delivery + bot)',
};

/** One rail as reported by /api/payments/methods. */
interface RailStatus {
  currency: string;
  network: string;
  label: string;
  ready: boolean;
  reason: string | null;
  rate: number | null;
}

export default function AdminSettingsPage() {
  const [data, setData] = useState<SystemPayload | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // What checkout is actually offering right now, and why anything is missing.
  // Read from the same endpoint the storefront uses, so this can never claim a
  // rail is live while the storefront hides it.
  const [rails, setRails] = useState<RailStatus[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/data?resource=system', { cache: 'no-store' });
      if (!res.ok) {
        setError(`Could not load configuration (HTTP ${res.status}).`);
        return;
      }
      const body = (await res.json()) as SystemPayload & { ok: boolean };
      setData(body);
      const next: Record<string, string> = {};
      for (const row of body.config) next[row.key] = row.value;
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/payments/methods', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { methods?: RailStatus[] } | null) => {
        if (!cancelled && body?.methods) setRails(body.methods);
      })
      .catch(() => {
        // Leave the card in its loading state; the rest of the page still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(key: string) {
    const value = (draft[key] ?? '').trim();
    const field = WALLET_FIELDS.find((item) => item.key === key);
    if (field && !field.pattern.test(value)) {
      toast.error(`${field.label}: that does not look like a valid value.`);
      return { ok: false, error: 'invalid_format' };
    }
    const result = await adminAction('app_config_set', { key, value });
    if (!result.ok) return result;
    toast.success('Deposit configuration updated');
    setData((prev) =>
      prev
        ? {
            ...prev,
            config: prev.config.map((row) =>
              row.key === key ? { ...row, value, updated_at: new Date().toISOString() } : row,
            ),
          }
        : prev,
    );
    return result;
  }

  const configByKey: Record<string, ConfigRow> = {};
  for (const row of data?.config ?? []) configByKey[row.key] = row;

  const missingServices = Object.entries(data?.services ?? {}).filter(([, configured]) => !configured);
  const walletCount = WALLET_FIELDS.filter((field) => {
    const value = configByKey[field.key]?.value;
    return value && !value.startsWith('REPLACE_ME');
  }).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold">Settings</h1>
          <p className="text-sm text-text-muted">
            Deposit addresses, product prices and the integrations this deployment depends on.
          </p>
        </div>
        <button type="button" className={adminButtonClass('secondary')} onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
          Reload
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Deposit wallets set" value={`${walletCount} / ${WALLET_FIELDS.length}`} hint="Addresses create_order quotes from" icon={Wallet} tone={walletCount === WALLET_FIELDS.length ? 'success' : 'warn'} />
        <StatCard label="Integrations missing" value={missingServices.length} hint="Env vars not visible to this deployment" icon={KeyRound} tone={missingServices.length ? 'warn' : 'success'} />
        <StatCard
          label="Products"
          value={(data?.prices.length ?? 0)}
          hint="Rows in challenge_prices"
          icon={CreditCard}
          tone="info"
        />
        <StatCard
          label="Config keys"
          value={data?.config.length ?? 0}
          hint="Runtime values in app_config"
          icon={Settings}
          tone="neutral"
        />
      </div>

      <SectionCard
        title="Payment rails"
        description="Live checkout availability, computed exactly as the storefront computes it (deposit address + verifier + price feed)."
      >
        {rails === null ? (
          <p className="py-4 text-center text-xs text-text-muted">Checking…</p>
        ) : (
          <ul className="space-y-2">
            {rails.map((rail) => (
              <li
                key={`${rail.currency}-${rail.network}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800/50 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="text-xs font-medium">{rail.label}</span>
                  {rail.rate && rail.currency === 'BTC' && !rail.ready && (
                    <span className="ml-2 text-[11px] text-text-muted">quoted ${rail.rate.toLocaleString('en-US')}</span>
                  )}
                </span>
                <StatusPill tone={rail.ready ? 'success' : 'danger'}>
                  {rail.ready ? 'live' : rail.reason ?? 'unavailable'}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Deposit addresses"
        description="What checkout quotes to customers. Changing an address affects new orders only — existing pending orders keep the address they were created with."
      >
        <div className="space-y-4">
          {WALLET_FIELDS.map((field) => {
            const current = configByKey[field.key]?.value ?? '';
            const value = draft[field.key] ?? '';
            const valid = field.pattern.test(value.trim());
            const changed = value.trim() !== current;
            return (
              <div key={field.key} className="rounded-lg border border-amber-500/10 bg-navy-800/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{field.label}</p>
                    <p className="text-[11px] text-text-muted">{field.hint}</p>
                  </div>
                  {current && !current.startsWith('REPLACE_ME') ? (
                    <StatusPill tone="success">configured</StatusPill>
                  ) : (
                    <StatusPill tone="danger">not set</StatusPill>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={value}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    spellCheck={false}
                    autoComplete="off"
                    aria-label={field.label}
                    className="min-w-0 flex-1 rounded-lg border border-amber-500/10 bg-navy-900 px-3 py-2 font-mono text-xs focus:border-amber-400/40 focus:outline-none"
                  />
                  <AsyncButton
                    variant={changed ? 'primary' : 'secondary'}
                    icon={Save}
                    disabled={!changed || !valid}
                    disabledReason="Enter a valid address to enable saving"
                    onRun={() => save(field.key)}
                  >
                    Save
                  </AsyncButton>
                </div>
                {value && !valid && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                    <X className="h-3 w-3" />
                    That does not match the expected format for this network.
                  </p>
                )}
                {configByKey[field.key] && (
                  <p className="mt-1 text-[11px] text-text-muted">
                    Last changed {formatDateTime(configByKey[field.key].updated_at)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Integrations" description="Presence only — secret values are never exposed to the browser.">
          {loading ? (
            <p className="py-4 text-center text-xs text-text-muted">Checking…</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(data?.services ?? {}).map(([key, configured]) => (
                <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-navy-800/50 px-3 py-2">
                  <span className="min-w-0 truncate text-xs">{SERVICE_LABELS[key] ?? key}</span>
                  <StatusPill tone={configured ? 'success' : 'danger'}>
                    {configured ? <Check className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
                    {configured ? 'configured' : 'missing'}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-text-muted">
            Missing integrations degrade one feature rather than breaking the app. No rail needs a key to be
            verified: USDC is checked through keyless Etherscan-shaped mirrors (an Etherscan key is only used in
            preference to them when it is set), and USDT-TRC20 and BTC need no key at all. Without a cron secret the
            BTC price is only refreshed when a customer reaches checkout, and without Resend the rule emails stay
            queued in the activity log.
          </p>
        </SectionCard>

        <SectionCard title="Product prices" description="Read from challenge_prices — the only source create_order trusts.">
          {loading ? (
            <p className="py-4 text-center text-xs text-text-muted">Loading…</p>
          ) : (data?.prices.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-xs text-text-muted">
              No price rows found. Checkout will refuse to quote until challenge_prices is populated.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-500/10 text-left text-[11px] uppercase tracking-wide text-text-muted">
                    <th className="px-2 py-2 font-medium">Account</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 text-right font-medium">Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.prices.map((price) => (
                    <tr key={`${price.account_size}-${price.challenge_type}`} className="border-b border-amber-500/5 last:border-0">
                      <td className="px-2 py-2">{usdCompact(price.account_size)}</td>
                      <td className="px-2 py-2 capitalize">{price.challenge_type}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{usd.format(Number(price.price_usd))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="All runtime configuration" description="Everything in app_config, as the app sees it.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-500/10 text-left text-[11px] uppercase tracking-wide text-text-muted">
                <th className="px-2 py-2 font-medium">Key</th>
                <th className="px-2 py-2 font-medium">Value</th>
                <th className="px-2 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(data?.config ?? []).map((row) => (
                <tr key={row.key} className="border-b border-amber-500/5 last:border-0">
                  <td className="px-2 py-2 font-mono text-[11px]">{row.key}</td>
                  <td className="px-2 py-2 font-mono text-[11px] text-text-secondary">{row.value}</td>
                  <td className="px-2 py-2 text-[11px] text-text-muted">{formatDateTime(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
