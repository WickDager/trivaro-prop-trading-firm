import type { Metadata } from 'next';

// The login page itself is a client component, so it cannot export `metadata`.
// This layout gives the route its own title and description instead of
// inheriting the site-wide default from the root layout.
const title = 'Sign In';
const description =
  'Sign in to your Trivaro account to start a challenge, track your evaluation and manage your funded account.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
