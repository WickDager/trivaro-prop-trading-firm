/**
 * Hand-maintained database types.
 *
 * supabase-js requires every table to declare `Row`, `Insert`, `Update` AND
 * `Relationships`, and the schema to declare `Tables`, `Views` and `Functions`.
 * Omit any one of them and the whole `Database` fails to satisfy `GenericSchema`
 * — every `.from()` then resolves to `never`, which is what broke `next build`.
 *
 * Regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.types.ts
 */

type OrdersRow = {
  id: string;
  user_id: string | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  challenge_type: string;
  account_size: number;
  phase: number;
  amount_usd: number;
  crypto_amount: number | null;
  crypto_currency: string;
  network: string;
  wallet_address: string | null;
  payment_id: string;
  status: string;
  tx_hash: string | null;
  verified_at: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
}

type ChallengesRow = {
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
  status: string;
  current_equity: number | null;
  highest_equity: number | null;
  lowest_equity: number | null;
  starting_balance: number;
  daily_peak_equity: number | null;
  daily_peak_date: string | null;
  trading_days: number;
  last_trade_date: string | null;
  total_trades: number;
  winning_trades: number;
  /** Free practice challenge — never eligible for funding or payout. */
  is_trial: boolean;
  trial_ends_at: string | null;
  trial_passed_at: string | null;
  /** Baseline for the CURRENT phase's profit target (migration 014). */
  phase_start_equity: number | null;
  created_at: string;
  updated_at: string;
}

type TradesRow = {
  id: string;
  challenge_id: string;
  external_id: string | null;
  symbol: string;
  type: string | null;
  lots: number | null;
  open_price: number | null;
  close_price: number | null;
  profit: number | null;
  open_time: string | null;
  close_time: string | null;
}

type ProfilesRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  /** Added by migration 011. */
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
  telegram_id: number | null;
  role: string;
  kyc_status: string | null;
  created_at: string;
}

type CertificatesRow = {
  id: string;
  user_id: string;
  challenge_id: string;
  certificate_number: string;
  trader_name: string;
  account_size: number;
  completion_date: string;
  status: string;
  issued_by: string | null;
  revoked_at: string | null;
  created_at: string;
}

type AdminAuditLogRow = {
  id: string;
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

type EquitySnapshotsRow = {
  id: string;
  challenge_id: string;
  snapshot_date: string;
  equity: number;
  /** Written by bridge/mt5_bridge.py. */
  balance: number | null;
  peak_equity: number | null;
  daily_peak: number | null;
  trade_count: number;
  created_at: string;
}

type NotificationLogRow = {
  id: string;
  challenge_id: string;
  user_id: string;
  type: string;
  status: string;
  recipient_email: string;
  subject: string;
  rule_violated: string | null;
  equity_at_time: number | null;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: OrdersRow;
        Insert: {
          id?: string;
          user_id?: string | null;
          telegram_user_id?: number | null;
          telegram_username?: string | null;
          challenge_type: string;
          account_size: number;
          phase?: number;
          amount_usd: number;
          crypto_amount?: number | null;
          crypto_currency?: string;
          network?: string;
          wallet_address?: string | null;
          payment_id: string;
          status?: string;
          tx_hash?: string | null;
          verified_at?: string | null;
          created_at?: string;
          expires_at?: string;
          paid_at?: string | null;
        };
        Update: {
          user_id?: string | null;
          telegram_user_id?: number | null;
          telegram_username?: string | null;
          challenge_type?: string;
          account_size?: number;
          phase?: number;
          amount_usd?: number;
          crypto_amount?: number | null;
          crypto_currency?: string;
          network?: string;
          wallet_address?: string | null;
          payment_id?: string;
          status?: string;
          tx_hash?: string | null;
          verified_at?: string | null;
          expires_at?: string;
          paid_at?: string | null;
        };
        Relationships: [];
      };
      challenges: {
        Row: ChallengesRow;
        Insert: {
          id?: string;
          order_id?: string | null;
          user_id?: string | null;
          account_number?: string | null;
          account_password?: string | null;
          server?: string | null;
          profit_target: number;
          max_drawdown: number;
          daily_drawdown: number;
          min_trading_days?: number;
          status?: string;
          current_equity?: number | null;
          highest_equity?: number | null;
          lowest_equity?: number | null;
          starting_balance?: number;
          daily_peak_equity?: number | null;
          daily_peak_date?: string | null;
          trading_days?: number;
          last_trade_date?: string | null;
          total_trades?: number;
          winning_trades?: number;
          is_trial?: boolean;
          trial_ends_at?: string | null;
          trial_passed_at?: string | null;
          phase_start_equity?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          order_id?: string | null;
          user_id?: string | null;
          account_number?: string | null;
          account_password?: string | null;
          server?: string | null;
          profit_target?: number;
          max_drawdown?: number;
          daily_drawdown?: number;
          min_trading_days?: number;
          status?: string;
          current_equity?: number | null;
          highest_equity?: number | null;
          lowest_equity?: number | null;
          starting_balance?: number;
          daily_peak_equity?: number | null;
          daily_peak_date?: string | null;
          trading_days?: number;
          last_trade_date?: string | null;
          total_trades?: number;
          winning_trades?: number;
          is_trial?: boolean;
          trial_ends_at?: string | null;
          trial_passed_at?: string | null;
          phase_start_equity?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: TradesRow;
        Insert: {
          id?: string;
          challenge_id: string;
          external_id?: string | null;
          symbol: string;
          type?: string | null;
          lots?: number | null;
          open_price?: number | null;
          close_price?: number | null;
          profit?: number | null;
          open_time?: string | null;
          close_time?: string | null;
        };
        Update: {
          external_id?: string | null;
          symbol?: string;
          type?: string | null;
          lots?: number | null;
          open_price?: number | null;
          close_price?: number | null;
          profit?: number | null;
          open_time?: string | null;
          close_time?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfilesRow;
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          telegram_username?: string | null;
          telegram_id?: number | null;
          role?: string;
          kyc_status?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          telegram_username?: string | null;
          telegram_id?: number | null;
          role?: string;
          kyc_status?: string | null;
        };
        Relationships: [];
      };
      certificates: {
        Row: CertificatesRow;
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          certificate_number: string;
          trader_name: string;
          account_size: number;
          completion_date: string;
          status?: string;
          issued_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          certificate_number?: string;
          trader_name?: string;
          account_size?: number;
          completion_date?: string;
          status?: string;
          issued_by?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [];
      };
      admin_audit_log: {
        Row: AdminAuditLogRow;
        Insert: {
          id?: string;
          admin_id?: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details?: Record<string, unknown>;
          ip_address?: string | null;
          created_at?: string;
        };
        // The audit log is append-only by design; `Update` exists only so the
        // table satisfies supabase-js's GenericTable shape.
        Update: {
          details?: Record<string, unknown>;
        };
        Relationships: [];
      };
      equity_snapshots: {
        Row: EquitySnapshotsRow;
        Insert: {
          id?: string;
          challenge_id: string;
          snapshot_date: string;
          equity: number;
          balance?: number | null;
          peak_equity?: number | null;
          daily_peak?: number | null;
          trade_count?: number;
          created_at?: string;
        };
        Update: {
          equity?: number;
          balance?: number | null;
          peak_equity?: number | null;
          daily_peak?: number | null;
          trade_count?: number;
        };
        Relationships: [];
      };
      challenge_prices: {
        Row: {
          account_size: number;
          challenge_type: string;
          price_usd: number;
        };
        Insert: {
          account_size: number;
          challenge_type: string;
          price_usd: number;
        };
        Update: {
          price_usd?: number;
        };
        Relationships: [];
      };
      app_config: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          value?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: NotificationLogRow;
        Insert: {
          id?: string;
          challenge_id: string;
          user_id: string;
          type: string;
          status?: string;
          recipient_email: string;
          subject: string;
          rule_violated?: string | null;
          equity_at_time?: number | null;
          metadata?: Record<string, unknown>;
          sent_at?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          sent_at?: string | null;
          error_message?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      /** The only way an order is created (migration 015). Price is derived
       *  server-side from challenge_prices and cannot be supplied by the caller. */
      create_order: {
        Args: {
          p_account_size: number;
          p_challenge_type?: string;
          p_network?: string;
          p_crypto_currency?: string;
        };
        Returns: {
          order_id: string;
          payment_id: string;
          amount_usd: number;
          crypto_amount: number;
          wallet_address: string;
          network: string;
          expires_at: string;
        }[];
      };
      /** Grants the one-per-user free trial (migration 016). Idempotent. */
      start_trial: {
        Args: Record<string, never>;
        Returns: {
          challenge_id: string;
          account_size: number;
          trial_ends_at: string;
          profit_target: number;
          max_drawdown: number;
          daily_drawdown: number;
          min_trading_days: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
