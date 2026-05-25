import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

export function GlowButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      variant="glow"
      className={cn(
        'relative overflow-hidden',
        'before:absolute before:inset-0 before:-z-10',
        'before:animate-glow',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
