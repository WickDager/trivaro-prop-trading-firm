'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Challenge } from '@trivaro/shared-types';

interface AccountCardProps {
  challenge: Challenge;
}

export function AccountCard({ challenge }: AccountCardProps) {
  const isPositive = (challenge.current_equity ?? 0) >= challenge.profit_target;

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
              ${challenge.current_equity?.toLocaleString() ?? '0.00'}
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
                Target: ${challenge.profit_target.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
