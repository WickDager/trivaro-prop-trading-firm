'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GradientText } from '@/components/shared/GradientText';
import { Skeleton } from '@/components/ui/skeleton';
import { PaymentStatus } from '@/components/payment/PaymentStatus';
import type { User } from '@supabase/supabase-js';

interface PaymentRecord {
  id: string;
  payment_id: string;
  amount_usd: number;
  crypto_currency: string;
  network: string;
  status: 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';
  created_at: string;
  account_size: number;
}

export default function PaymentsPage() {
  const { supabase } = useSupabase();
  const [user, setUser] = useState<User | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        setPayments(data as unknown as PaymentRecord[] ?? []);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Payment <GradientText as="span">History</GradientText>
        </h1>
        <p className="text-sm text-text-secondary">Track your challenge payments and their status</p>
      </div>

      {!user ? (
        <div className="flex h-[40vh] items-center justify-center">
          <p className="text-text-muted">Sign in to view payment history</p>
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center">
            <p className="text-text-muted">No payments yet. Start a challenge to see your payment history.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <Card key={payment.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0">
                  <p className="truncate font-medium">{payment.payment_id}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                    <span>${payment.amount_usd}</span>
                    <span>{payment.crypto_currency} ({payment.network})</span>
                    <span>${(payment.account_size / 1000).toFixed(0)}K account</span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <PaymentStatus status={payment.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
