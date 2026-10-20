import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';

const footerLinks = {
  Product: [
    { href: '/challenges', label: 'Challenges' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/rules', label: 'Challenge Rules' },
    { href: '/pricing', label: 'Pricing' },
  ],
  Company: [
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
  Legal: [
    { href: '/terms', label: 'Terms of Service' },
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/refund', label: 'Refund Policy' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-teal-500/10 bg-navy-900/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo className="mb-4 h-8" />
            <p className="max-w-xs text-sm text-text-muted">
              Funded traders. Real profits. Zero risk. Take your trading to the next level with Trivaro.
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              {/* h2, not h3: the footer can be the first heading level after
                  the page's h1 (e.g. /login), and an h3 there skipped a level. */}
              <h2 className="mb-3 text-sm font-semibold text-white">{title}</h2>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    {/* `py-1` lifts a 19px line of text to a 27px tap target;
                        WCAG 2.2 asks for 24px and these are stacked on phones. */}
                    <Link
                      href={link.href}
                      className="block py-1 text-sm text-text-secondary transition-colors hover:text-teal-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-teal-500/10 pt-8 text-center text-sm text-text-muted">
          &copy; {new Date().getFullYear()} Trivaro. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
