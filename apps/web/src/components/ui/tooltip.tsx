'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <div className="whitespace-nowrap rounded-md bg-navy-600 px-3 py-1.5 text-xs text-white shadow-lg">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
