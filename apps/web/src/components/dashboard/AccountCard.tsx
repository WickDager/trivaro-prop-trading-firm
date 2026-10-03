'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Challenge } from '@trivaro/shared-types';

interface AccountCardProps {
  challenge: Challenge;
}

export function AccountCard({ challenge }: AccountCardProps) {
  // `profit_target` is a PERCENTAGE (8.00), not dollars. The old comparison
  // `equity >= profit_target` was therefore always true (10000 >= 8), so the
  // loss icon never rendered, and the label printed "Target: $8".
  const startingBalance = Number(challenge.starting_balance) || 0;
  const targetPercent = Number(challenge.profit_target) || 0;
  const targetDollars = startingBalance * (targetPercent / 100);
  const equity = Number(challenge.current_equity) || startingBalance;
  const isPositive = targetDollars > 0 ? equity >= startingBalance + targetDollars : equity >= startingBalance;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {challenge.account_number ?? 'Challenge Account'}
        </CardTitle>
        <Badge variant={challenge.status === 'active' ? 'default' : 'success'}>
          {challenge.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-muted">Current Equity</p>
            <p className="font-heading text-2xl font-bold">
              {equity.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span className="text-sm text-text-secondary">
                Target: {targetDollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} ({targetPercent}%)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
