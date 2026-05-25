'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useClipboard({ timeout = 2000 } = {}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), timeout);
      } catch {
        toast.error('Failed to copy');
      }
    },
    [timeout],
  );

  return { copied, copy };
}
