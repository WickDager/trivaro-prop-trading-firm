'use client';

import { useClipboard } from '@/hooks/useClipboard';
import { Copy } from 'lucide-react';

interface WalletAddressProps {
  address: string;
  label?: string;
}

export function WalletAddress({ address, label = 'Wallet Address' }: WalletAddressProps) {
  const { copy } = useClipboard();

  return (
    <div>
      <p className="mb-1 text-xs text-text-muted">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-teal-500/10 bg-navy-700/60 px-3 py-2">
        <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm text-teal-400">
          {address}
        </code>
        <button
          onClick={() => copy(address)}
          className="shrink-0 text-text-secondary hover:text-teal-400"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
