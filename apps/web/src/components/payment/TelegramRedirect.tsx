'use client';

import { GlowButton } from '@/components/shared/GlowButton';
import { TELEGRAM_BOT_USERNAME } from '@/lib/constants';

interface TelegramRedirectProps {
  paymentId: string;
}

export function TelegramRedirect({ paymentId }: TelegramRedirectProps) {
  const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=order_${paymentId}`;

  return (
    <div className="text-center">
      <p className="mb-2 text-sm text-text-secondary">Continue to Telegram to complete payment</p>
      <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
        <GlowButton size="lg" className="w-full">
          Open Telegram Bot
        </GlowButton>
      </a>
    </div>
  );
}
