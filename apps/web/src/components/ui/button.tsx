import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // `whitespace-normal` at base + `whitespace-nowrap` per size: long labels on
  // full-width mobile CTAs must wrap instead of overflowing the viewport.
  // Text on the brand (cyan/green) fills is navy, not white — white on #00D9FF
  // is ~1.9:1 and fails WCAG AA badly.
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-800 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]',
  {
    variants: {
      variant: {
        default: 'bg-teal-500 text-navy-900 hover:bg-teal-400 shadow-lg shadow-teal-glow',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-teal-500/30 text-teal-400 hover:bg-teal-500/10 active:bg-teal-500/20',
        secondary: 'bg-navy-700 text-white hover:bg-navy-600',
        ghost: 'text-text-secondary hover:text-white hover:bg-navy-700 active:bg-navy-600',
        link: 'text-teal-400 underline-offset-4 hover:underline',
        glow: 'bg-gradient-to-r from-teal-500 to-green-500 text-navy-900 shadow-lg shadow-teal-glow hover:shadow-xl hover:shadow-teal-glow hover:scale-105',
      },
      size: {
        // 44px minimum touch target on phones, tightening up on >=sm.
        default: 'min-h-11 px-4 py-2 sm:h-10 sm:min-h-0',
        sm: 'min-h-10 rounded-md px-3 text-xs sm:h-9 sm:min-h-0',
        lg: 'min-h-12 rounded-lg px-8 text-base',
        xl: 'min-h-14 rounded-xl px-8 text-base sm:px-10 sm:text-lg',
        icon: 'h-11 w-11 shrink-0 sm:h-10 sm:w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => {
    return (
      <button
        // Defaults to "button" so a stray Button inside a <form> does not
        // submit it; pass type="submit" explicitly where intended.
        type={type ?? 'button'}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
