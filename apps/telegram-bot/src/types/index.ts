export interface TelegramMessage {
  message_id: number;
  chat: { id: number; username?: string };
  text?: string;
  from?: { id: number; username?: string };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

export interface PaymentInvoice {
  payment_id: string;
  wallet_address: string;
  crypto_amount: number;
  crypto_currency: string;
  network: string;
  amount_usd: number;
  expires_at: string;
}

export interface AccountCredentials {
  account_number: string;
  account_password: string;
  server: string;
}
