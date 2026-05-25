import Link from 'next/link';
import { Logo } from '@/components/shared/Logo';

const footerLinks = {
  Product: [
    { href: '/challenges', label: 'Challenges' },
    { href: '/how-it-works', label: 'How It Works' },
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
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo className="mb-4 h-8" />
            <p className="max-w-xs text-sm text-text-muted">
              Funded traders. Real profits. Zero risk. Take your trading to the next level with Trivaro.
            </p>
          </div>
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-secondary transition-colors hover:text-teal-400"
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
