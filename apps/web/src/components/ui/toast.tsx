'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#0D1F35',
          color: '#FFFFFF',
          border: '1px solid rgba(0, 217, 255, 0.1)',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
