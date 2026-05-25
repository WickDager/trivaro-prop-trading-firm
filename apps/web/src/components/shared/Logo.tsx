import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'full' | 'icon' | 'monogram';
  className?: string;
}

export function Logo({ variant = 'full', className }: LogoProps) {
  if (variant === 'icon') {
    return (
      <img
        src="/icons/trivaro-icon.svg"
        alt="Trivaro"
        className={cn('h-10 w-10', className)}
      />
    );
  }

  if (variant === 'monogram') {
    return (
      <img
        src="/icons/trivaro-monogram.svg"
        alt="T"
        className={cn('h-8 w-8', className)}
      />
    );
  }

  return (
    <img
      src="/brand/trivaro-logo-main.svg"
      alt="Trivaro"
      className={cn('h-8 w-auto', className)}
    />
  );
}
