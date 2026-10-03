import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-teal-500/20 text-teal-400',
        secondary: 'border-transparent bg-navy-600 text-text-secondary',
        destructive: 'border-transparent bg-red-500/20 text-red-400',
        success: 'border-transparent bg-green-500/20 text-green-400',
        outline: 'border-teal-500/30 text-teal-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// A <span>: badges are inline labels and are rendered inside table cells and
// paragraphs, where a block-level <div> is invalid HTML.
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
