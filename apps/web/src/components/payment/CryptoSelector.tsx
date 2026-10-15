'use client';

import { Check, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SUPPORTED_CRYPTO,
  DEFAULT_ENABLED_NETWORKS,
  cryptoAssetKey,
  type CryptoAsset,
} from '@/lib/constants';

/**
 * Availability comes from /api/payments/methods (deposit address + verifier
 * key). Until that answers we fall back to the rails that are verifiable with
 * no extra configuration, so a slow request can never advertise a network the
 * verifier cannot check.
 */
export interface CryptoSelectorProps {
  onSelect: (asset: CryptoAsset) => void;
  /** `USDT-TRC20` style key of the current selection. */
  selected?: string;
  enabledNetworks?: ReadonlySet<string>;
  /** `USDT-ERC20` style keys reported ready by the server. */
  readyKeys?: ReadonlySet<string>;
  /** Why a rail is unavailable, keyed the same way. */
  reasons?: Record<string, string | null>;
}

/** Currency glyphs. `slice(-1)` used to be used here, which rendered "T" for
 *  USDT and "C" for USDC — unrecognisable as money. */
const SYMBOLS: Record<string, string> = { USDT: '₮', USDC: '$', BTC: '₿' };

export function CryptoSelector({ onSelect, selected, enabledNetworks, readyKeys, reasons }: CryptoSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Cryptocurrency">
      {SUPPORTED_CRYPTO.map((asset) => {
        const key = cryptoAssetKey(asset.currency, asset.network);
        const isSelected = selected === key;
        const enabled = readyKeys
          ? readyKeys.has(key)
          : enabledNetworks
            ? enabledNetworks.has(asset.network)
            : DEFAULT_ENABLED_NETWORKS.has(asset.network);
        const reason = reasons?.[key] ?? (enabled ? null : 'Coming soon');

        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={!enabled}
            disabled={!enabled}
            onClick={() => onSelect(asset)}
            className={cn(
              // `items-start` + `text-left` + `min-w-0`: long labels wrap inside
              // the card instead of overflowing into the neighbouring card.
              'relative flex min-h-16 w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99]',
              isSelected
                ? 'border-teal-400 bg-teal-500/10'
                : 'border-teal-500/10 bg-navy-700/60 hover:border-teal-500/30',
              !enabled && 'cursor-not-allowed opacity-50 hover:border-teal-500/10',
            )}
          >
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold',
                enabled ? 'bg-teal-500/20 text-teal-400' : 'bg-navy-600 text-text-muted',
              )}
            >
              {SYMBOLS[asset.currency] ?? asset.currency.slice(0, 1)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{asset.label}</span>
                <span className="rounded bg-navy-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                  {asset.networkLabel}
                </span>
                {isSelected && enabled && <Check className="h-4 w-4 shrink-0 text-teal-400" />}
              </span>
              <span className="mt-1 block text-[11px] text-text-muted">
                {enabled ? `${asset.speed} · ${asset.fee}` : reason}
              </span>
            </span>
          </button>
        );
      })}

      <p className="flex items-start gap-1.5 text-[11px] text-text-muted sm:col-span-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Payouts are made in the same cryptocurrency you paid with. A network appears here as soon as its on-chain
        verification is live — we would rather hold an option back than accept a payment we cannot confirm.
      </p>
    </div>
  );
}
