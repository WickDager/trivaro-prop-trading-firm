const REQUEST_TIMEOUT_MS = 10_000;

export async function verifyTronPayment(wallet: string, expectedAmount: number): Promise<string | null> {
  const apiKey = Deno.env.get('TRONGRID_API_KEY');
  const headers: Record<string, string> = {};
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

  let res: Response;
  try {
    res = await fetch(
      `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20?limit=20`,
      // No default timeout in Deno's fetch: a hung TronGrid call used to stall
      // the caller indefinitely.
      { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
  } catch (error) {
    console.error('TronGrid request failed:', error);
    return null;
  }

  if (!res.ok) {
    // Without this check a 429/5xx body was parsed as if it were results,
    // making a failed lookup look like "no payment found".
    console.error(`TronGrid returned HTTP ${res.status}`);
    return null;
  }

  let data: { data?: Array<{ value: number; block_timestamp: number; token_info?: { symbol?: string }; transaction_id?: string }> };
  try {
    data = await res.json();
  } catch {
    console.error('TronGrid returned a non-JSON body');
    return null;
  }

  const recentTx = data.data?.find((tx) => {
    const amount = tx.token_info?.symbol === 'USDT' ? tx.value / 1e6 : 0;
    const isRecent = Date.now() - tx.block_timestamp < 30 * 60 * 1000;
    return isRecent && Math.abs(amount - expectedAmount) < 0.01;
  });
  return recentTx?.transaction_id ?? null;
}

export async function verifyBtcPayment(wallet: string): Promise<string | null> {
  const token = Deno.env.get('BLOCKCYPHER_TOKEN');
  const url = token
    ? `https://api.blockcypher.com/v1/btc/main/addrs/${wallet}/full?token=${token}`
    : `https://api.blockcypher.com/v1/btc/main/addrs/${wallet}/full`;

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    console.error('BlockCypher request failed:', error);
    return null;
  }

  if (!res.ok) {
    console.error(`BlockCypher returned HTTP ${res.status}`);
    return null;
  }

  try {
    const data = await res.json();
    return data.txs?.[0]?.hash ?? null;
  } catch {
    console.error('BlockCypher returned a non-JSON body');
    return null;
  }
}
