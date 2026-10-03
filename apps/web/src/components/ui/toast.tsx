'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      // Top-centre: bottom-right toasts on mobile sit under the iOS home
      // indicator and behind the dashboard's bottom sheet.
      position="top-center"
      theme="dark"
      mobileOffset={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      toastOptions={{
        classNames: {
          toast: 'bg-navy-700 text-white border border-teal-muted',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
