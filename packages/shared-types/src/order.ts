export type ChallengeType = 'balance' | 'equity';
export type AccountSize = 5000 | 10000 | 25000 | 50000 | 100000;
export type CryptoCurrency = 'USDT' | 'USDC' | 'BTC';
export type Network = 'TRC20' | 'ERC20' | 'BASE' | 'BTC';
export type OrderStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refunded';

export interface Order {
  id: string;
  user_id: string | null;
  telegram_user_id: number | null;
  telegram_username: string | null;
  challenge_type: ChallengeType;
  account_size: AccountSize;
  phase: number;
  amount_usd: number;
  crypto_amount: number | null;
  crypto_currency: CryptoCurrency;
  network: Network;
  wallet_address: string | null;
  payment_id: string;
  status: OrderStatus;
  tx_hash: string | null;
  verified_at: string | null;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
}
