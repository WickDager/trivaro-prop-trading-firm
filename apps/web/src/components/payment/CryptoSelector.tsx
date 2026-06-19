'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

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
}

export function CryptoSelector({ onSelect, selected }: CryptoSelectorProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {options.map((opt) => (
        <button
          key={`${opt.currency}-${opt.network}`}
          onClick={() => onSelect(opt)}
          className={cn(
            'relative flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all',
            selected === `${opt.currency}-${opt.network}`
              ? 'border-teal-400 bg-teal-500/10'
              : 'border-teal-500/10 bg-navy-700/60 hover:border-teal-500/30',
          )}
        >
          {selected === `${opt.currency}-${opt.network}` && (
            <Check className="absolute right-2 top-2 h-4 w-4 text-teal-400" />
          )}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 font-mono text-lg font-bold text-teal-400">
            {opt.icon}
          </span>
          <span className="text-xs font-medium">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
