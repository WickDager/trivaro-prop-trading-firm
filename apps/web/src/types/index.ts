export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
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
        };
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
      };
      challenges: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
      };
      trades: {
        Row: {
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
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          telegram_username: string | null;
          telegram_id: number | null;
          role: string;
          kyc_status: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          telegram_username?: string | null;
          telegram_id?: number | null;
          role?: string;
          kyc_status?: string | null;
          created_at?: string;
        };
      };
      certificates: {
        Row: {
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
        };
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          details: Record<string, unknown>;
          ip_address: string | null;
          created_at: string;
        };
      };
      equity_snapshots: {
        Row: {
          id: string;
          challenge_id: string;
          snapshot_date: string;
          equity: number;
          peak_equity: number;
          daily_peak: number;
          trade_count: number;
          created_at: string;
        };
      };
      notification_log: {
        Row: {
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
        };
      };
    };
  };
}
