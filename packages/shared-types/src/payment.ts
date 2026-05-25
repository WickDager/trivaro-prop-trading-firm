export interface PaymentInvoice {
  payment_id: string;
  wallet_address: string;
  crypto_amount: number;
  crypto_currency: string;
  network: string;
  amount_usd: number;
  expires_at: string;
  qr_code: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  tx_hash: string | null;
  confirmations: number;
}

export interface ChallengePricing {
  accountSize: number;
  balanceChallenge: number;
  equityChallenge: number;
  profitTarget: number;
  maxDrawdown: number;
  dailyDrawdown: number;
  minTradingDays: number;
}
