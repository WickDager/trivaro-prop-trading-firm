const TELEGRAM_API = `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')!}`;

async function sendMessage(chatId: number, text: string, parseMode?: string) {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function handleSupport(chatId: number) {
  const msg = [
    '🤖 *Trivaro Bot Help*',
    '',
    '*/start* — Start payment for an order',
    '*/help* — Show this message',
    '*/support* — Contact human support',
    '',
    '📧 Email: support@trivaro.com',
    '💬 Telegram: @TrivaroSupport',
  ].join('\n');

  await sendMessage(chatId, msg, 'Markdown');
}
