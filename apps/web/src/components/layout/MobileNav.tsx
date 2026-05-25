'use client';

import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/challenges', label: 'Challenges' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/dashboard', label: 'Dashboard' },
];

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <nav className="flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-3 text-text-secondary transition-colors hover:bg-navy-700 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/challenges">
            <Button variant="glow" className="mt-2 w-full">
              Start Challenge
            </Button>
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
