'use client';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { TELEGRAM_BOT_USERNAME } from '@/lib/constants';

interface TelegramRedirectProps {
  paymentId: string;
}

export function TelegramRedirect({ paymentId }: TelegramRedirectProps) {
  const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=order_${paymentId}`;

  return (
    <div className="text-center">
      <p className="mb-2 text-sm text-text-secondary">Continue to Telegram to complete payment</p>
      <a
        href={telegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: 'glow', size: 'lg' }), 'w-full')}
      >
        Open Telegram Bot
      </a>
    </div>
  );
}
