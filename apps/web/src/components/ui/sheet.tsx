'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | undefined>(undefined);

function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error('Sheet components must be used within a Sheet');
  return ctx;
}

export function Sheet({ children, open: controlledOpen, onOpenChange }: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({ children }: { children: React.ReactNode }) {
  const { setOpen } = useSheet();
  const child = React.Children.only(children) as React.ReactElement<{ onClick?: () => void }>;
  return React.cloneElement(child, { onClick: () => setOpen(true) });
}

export function SheetContent({ children, side = 'bottom', className }: {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}) {
  const { open, setOpen } = useSheet();
  if (!open) return null;

  const sideClasses = {
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div
        className={cn(
          'fixed z-50 border border-teal-500/10 bg-navy-800 p-6 shadow-2xl',
          side === 'bottom' && 'rounded-t-2xl',
          sideClasses[side],
          side === 'bottom' && 'max-h-[85vh] overflow-y-auto',
          side === 'left' && 'w-72',
          side === 'right' && 'w-72',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
