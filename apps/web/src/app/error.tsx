'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // There is no error-reporting service wired up yet; at minimum leave a
    // trail the browser and any future log drain can pick up.
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-navy-800 px-6 text-center">
      <h1 className="font-heading text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 max-w-md text-sm text-text-secondary">
        An unexpected error occurred. You can try again — if it keeps happening, please contact
        support.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-text-muted">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-8 min-h-11 rounded-lg bg-teal-500 px-6 font-medium text-navy-900 transition-colors hover:bg-teal-400 active:scale-[0.97]"
      >
        Try again
      </button>
    </div>
  );
}
