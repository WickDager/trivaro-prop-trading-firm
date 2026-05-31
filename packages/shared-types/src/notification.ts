export type NotificationType = 'challenge_failed' | 'phase_complete' | 'daily_drawdown_warning';
export type NotificationStatus = 'pending' | 'sent' | 'failed';
export type RuleViolation = 'daily_drawdown' | 'max_drawdown' | 'profit_target_reached' | 'none';

export interface NotificationMetadata {
  profit_pct: number;
  daily_drawdown_pct: number;
  max_drawdown_pct: number;
  trading_days: number;
  starting_balance: number;
  account_size: number;
}

export interface NotificationLog {
  id: string;
  challenge_id: string;
  user_id: string;
  type: NotificationType;
  status: NotificationStatus;
  recipient_email: string;
  subject: string;
  rule_violated: RuleViolation | null;
  equity_at_time: number | null;
  metadata: NotificationMetadata;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}
