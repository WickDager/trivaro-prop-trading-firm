'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
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
  const contentId = React.useId();
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange],
  );

  // Lock body scroll while the sheet is open. `position: fixed` is used to stop
  // iOS rubber-banding, but that resets the scroll offset unless we pin the
  // body with `top: -<scrollY>` and restore it on close. Without this the page
  // jumps to the top and stays there after the menu closes.
  React.useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  return (
    <SheetContext.Provider value={{ open, setOpen, contentId }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({ children, className, asChild = true }: {
  children: React.ReactNode;
  className?: string;
  asChild?: boolean;
}) {
  const { setOpen, open, contentId } = useSheet();
  const triggerProps = {
    onClick: () => setOpen(true),
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
    'aria-controls': open ? contentId : undefined,
  };

  if (!asChild) {
    return (
      <button type="button" className={className} {...triggerProps}>
        {children}
      </button>
    );
  }

  const child = React.Children.only(children) as React.ReactElement<{
    onClick?: () => void;
    className?: string;
  }>;
  return React.cloneElement(child, {
    ...triggerProps,
    className: cn(child.props.className, className),
  });
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export function SheetContent({ children, side = 'bottom', className, 'aria-label': ariaLabel }: {
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  'aria-label'?: string;
}) {
  const { open, setOpen, contentId } = useSheet();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  // The sheet must be portalled to <body>. Several triggers live inside headers
  // that use `backdrop-blur`, and a non-none backdrop-filter makes that header
  // the containing block for `position: fixed` descendants — which collapsed
  // the sheet into the height of the header bar.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const sideClasses = {
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
  };

  const animVariants = {
    top:    { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } },
    bottom: { initial: { y: '100%' },  animate: { y: 0 }, exit: { y: '100%' } },
    left:   { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
    right:  { initial: { x: '100%' },  animate: { x: 0 }, exit: { x: '100%' } },
  };

  const variants = animVariants[side];

  React.useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        const container = contentRef.current;
        if (!container) return;
        const focusable = getFocusableElements(container);
        if (focusable.length > 0) focusable[0].focus();
      });
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const container = contentRef.current;
      if (!container) return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            ref={contentRef}
            id={contentId}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? 'Menu'}
            className={cn(
              // Safe-area padding keeps the last row clear of the iOS home
              // indicator / Android gesture bar.
              'fixed z-50 overscroll-contain border border-teal-500/10 bg-navy-800 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl',
              side === 'bottom' && 'rounded-t-2xl',
              sideClasses[side],
              side === 'bottom' && 'max-h-[85dvh] overflow-y-auto',
              side === 'left' && 'w-72 overflow-y-auto',
              side === 'right' && 'w-72 overflow-y-auto',
              className,
            )}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-navy-700 hover:text-white active:bg-navy-600"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
