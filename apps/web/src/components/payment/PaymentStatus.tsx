'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PaymentStatusProps {
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';
}

const statusConfig = {
  pending: { label: 'Pending', variant: 'default' as const },
  paid: { label: 'Paid', variant: 'success' as const },
  expired: { label: 'Expired', variant: 'destructive' as const },
  failed: { label: 'Failed', variant: 'destructive' as const },
  refunded: { label: 'Refunded', variant: 'secondary' as const },
};

export function PaymentStatus({ status }: PaymentStatusProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
