import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-teal-500 text-white hover:bg-teal-600 shadow-lg shadow-teal-glow',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-teal-500/30 text-teal-400 hover:bg-teal-500/10',
        secondary: 'bg-navy-700 text-white hover:bg-navy-600',
        ghost: 'text-text-secondary hover:text-white hover:bg-navy-700',
        link: 'text-teal-400 underline-offset-4 hover:underline',
        glow: 'bg-gradient-to-r from-teal-500 to-green-500 text-white shadow-lg shadow-teal-glow hover:shadow-xl hover:shadow-teal-glow hover:scale-105',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        xl: 'h-14 rounded-xl px-10 text-lg',
        icon: 'h-10 w-10',
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
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
