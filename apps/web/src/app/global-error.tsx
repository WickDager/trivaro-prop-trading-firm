'use client';

/**
 * Catches errors thrown in the root layout itself. It replaces the whole
 * document, so it must render its own <html>/<body> and cannot rely on
 * globals.css being applied by the framework — styles are inlined.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A1628',
          color: '#FFFFFF',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '22px', margin: 0 }}>Something went wrong</h1>
        <p style={{ color: '#A0AEC0', fontSize: '14px', maxWidth: '28rem' }}>
          The application failed to load. Please try again.
        </p>
        {error.digest && (
          <p style={{ color: '#94A3B8', fontSize: '12px', fontFamily: 'monospace' }}>
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '28px',
            minHeight: '44px',
            padding: '0 24px',
            borderRadius: '10px',
            border: 'none',
            background: '#00D9FF',
            color: '#050B14',
            fontWeight: 600,
            fontSize: '15px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
