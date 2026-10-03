/**
 * Must match the CHECK constraint on public.challenges.status.
 * Migration 016 added 'trial' / 'trial_expired'; migration 012 added the
 * phase states. The previous union ('active' | 'passed' | 'failed' |
 * 'reviewing' | 'funded') omitted every value the app actually queries on.
 */
export type ChallengeStatus =
  | 'trial'
  | 'trial_expired'
  | 'active'
  | 'phase1_complete'
  | 'phase2_complete'
  | 'funded'
  | 'failed'
  | 'reviewing'
  | 'passed';

export interface Challenge {
  id: string;
  order_id: string | null;
  user_id: string | null;
  account_number: string | null;
  /** MT5 login password. Never select this into a client component. */
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
  /** Free practice challenge — never eligible for funding or payout. */
  is_trial: boolean;
  trial_ends_at: string | null;
  trial_passed_at: string | null;
  /** Baseline for the current phase's profit target (migration 014). */
  phase_start_equity: number | null;
}

export interface ChallengeWithMetrics extends Challenge {
  profitPercentage: number;
  drawdownPercentage: number;
  winRate: number;
  daysActive: number;
}
