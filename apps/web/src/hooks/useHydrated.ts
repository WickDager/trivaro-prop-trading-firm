'use client';

import { useEffect, useState } from 'react';

/**
 * True only after the first client render.
 *
 * Framer Motion serialises `initial={{ opacity: 0 }}` into the server-rendered
 * HTML, so a page whose content is wrapped in entrance animations renders as a
 * blank screen for anyone without JS (and for crawlers and link previews).
 * Gate the animated branch on this hook and render the plain, visible markup
 * until hydration.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
