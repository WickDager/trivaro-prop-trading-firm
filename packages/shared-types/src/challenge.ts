export type ChallengeStatus = 'active' | 'passed' | 'failed' | 'reviewing' | 'funded';

export interface Challenge {
  id: string;
  order_id: string;
  user_id: string;
  account_number: string | null;
  account_password: string | null;
  server: string | null;
  profit_target: number;
  max_drawdown: number;
  daily_drawdown: number;
  min_trading_days: number;
  status: ChallengeStatus;
  current_equity: number | null;
  highest_equity: number | null;
  lowest_equity: number | null;
  total_trades: number;
  winning_trades: number;
  created_at: string;
  starting_balance: number;
  daily_peak_equity: number | null;
  daily_peak_date: string | null;
  trading_days: number;
  last_trade_date: string | null;
  updated_at: string;
}

export interface ChallengeWithMetrics extends Challenge {
  profitPercentage: number;
  drawdownPercentage: number;
  winRate: number;
  daysActive: number;
}
