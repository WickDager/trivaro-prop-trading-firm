export async function verifyTronPayment(wallet: string, expectedAmount: number) {
  const apiKey = process.env.TRONGRID_API_KEY;
  const res = await fetch(
    `https://api.trongrid.io/v1/accounts/${wallet}/transactions/trc20?limit=20`,
    { headers: apiKey ? { 'TRON-PRO-API-KEY': apiKey } : {} },
  );
  const data = await res.json();
  const recentTx = data.data?.find((tx: any) => {
    const amount = tx.token_info?.symbol === 'USDT' ? tx.value / 1e6 : 0;
    const isRecent = Date.now() - tx.block_timestamp < 30 * 60 * 1000;
    return isRecent && Math.abs(amount - expectedAmount) < 0.01;
  });
  return recentTx?.transaction_id ?? null;
}

export async function verifyBtcPayment(wallet: string) {
  const token = process.env.BLOCKCYPHER_TOKEN;
  const url = token
    ? `https://api.blockcypher.com/v1/btc/main/addrs/${wallet}/full?token=${token}`
    : `https://api.blockcypher.com/v1/btc/main/addrs/${wallet}/full`;
  const res = await fetch(url);
  const data = await res.json();
  return data.txs?.[0]?.hash ?? null;
}
