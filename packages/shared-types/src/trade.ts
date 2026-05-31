export interface Trade {
  id: string;
  challenge_id: string;
  external_id: string | null;
  symbol: string;
  type: 'buy' | 'sell' | null;
  lots: number | null;
  open_price: number | null;
  close_price: number | null;
  profit: number | null;
  open_time: string | null;
  close_time: string | null;
}

export interface MT5TradeEntry {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  open_price: number;
  close_price: number;
  profit: number;
  open_time: string;
  close_time: string;
}

export interface MT5TradePayload {
  account_number: string;
  trades: MT5TradeEntry[];
}

export interface EquitySnapshot {
  id: string;
  challenge_id: string;
  snapshot_date: string;
  equity: number;
  peak_equity: number;
  daily_peak: number;
  trade_count: number;
}
