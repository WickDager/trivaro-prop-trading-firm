'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CryptoOption {
  currency: string;
  network: string;
  label: string;
  icon: string;
}

const options: CryptoOption[] = [
  { currency: 'USDT', network: 'TRC20', label: 'USDT (TRC20)', icon: 'T' },
  { currency: 'USDC', network: 'BASE', label: 'USDC (Base)', icon: 'U' },
  { currency: 'BTC', network: 'BTC', label: 'Bitcoin', icon: 'B' },
];

interface CryptoSelectorProps {
  onSelect: (option: CryptoOption) => void;
  selected?: string;
  /**
   * Networks whose payment verifier is live. Anything not listed is rendered
   * disabled — accepting a payment we cannot verify on-chain would take the
   * customer's money without crediting their order.
   */
  enabledNetworks?: ReadonlySet<string>;
}

export function CryptoSelector({ onSelect, selected, enabledNetworks }: CryptoSelectorProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {options.map((opt) => {
        const key = `${opt.currency}-${opt.network}`;
        const isSelected = selected === key;
        const disabled = enabledNetworks ? !enabledNetworks.has(opt.network) : false;

        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(opt)}
            className={cn(
              'relative flex min-h-11 flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all active:scale-[0.98]',
              isSelected
                ? 'border-teal-400 bg-teal-500/10'
                : 'border-teal-500/10 bg-navy-700/60 hover:border-teal-500/30',
              disabled && 'cursor-not-allowed opacity-40 hover:border-teal-500/10',
            )}
          >
            {isSelected && !disabled && (
              <Check className="absolute right-2 top-2 h-4 w-4 text-teal-400" />
            )}
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 font-mono text-lg font-bold text-teal-400">
              {opt.icon}
            </span>
            <span className="text-xs font-medium">{opt.label}</span>
            {disabled && <span className="text-[10px] text-text-muted">Coming soon</span>}
          </button>
        );
      })}
    </div>
  );
}
