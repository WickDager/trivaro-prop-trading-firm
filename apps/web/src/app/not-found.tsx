import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-navy-800 px-6 text-center">
      <p className="font-heading text-5xl font-bold text-teal-400">404</p>
      <h1 className="mt-4 font-heading text-2xl font-bold">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-text-secondary">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-500 px-6 font-medium text-navy-900 transition-colors hover:bg-teal-400 active:scale-[0.97]"
        >
          Back to home
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-teal-500/30 px-6 font-medium text-teal-400 transition-colors hover:bg-teal-500/10 active:scale-[0.97]"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
