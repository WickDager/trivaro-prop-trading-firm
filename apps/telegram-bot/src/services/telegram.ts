// Centralised Telegram API access for every handler.
//
// The token is validated at import time: `Deno.env.get('TELEGRAM_BOT_TOKEN')!`
// yielded undefined when unset, so the bot called ".../botundefined/sendMessage"
// and every send failed silently with no startup signal.

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!BOT_TOKEN) {
  throw new Error(
    'TELEGRAM_BOT_TOKEN is not set — refusing to start (every send would fail silently)',
  );
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Escape a value for Telegram's HTML parse mode.
 *
 * Messages interpolate user-controlled data (payment ids) and secrets
 * (account credentials). With parse_mode Markdown a stray `_` or backtick made
 * Telegram answer 400 and the user never received the message at all; HTML
 * needs only these three characters escaped, including inside <code>.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function callTelegram(
  method: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Deno's fetch has no default timeout — a hung Telegram request used to
      // block the webhook until Telegram gave up and redelivered the update.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Telegram ${method} failed: HTTP ${res.status} ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (error) {
    // Timeouts and network failures land here; without this they were invisible.
    console.error(`Telegram ${method} request error:`, error);
    return false;
  }
}

export function sendMessage(
  chatId: number,
  text: string,
  parseMode?: string,
): Promise<boolean> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) body.parse_mode = parseMode;
  return callTelegram('sendMessage', body);
}

export function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  parseMode = 'HTML',
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };
  if (parseMode) body.parse_mode = parseMode;
  return callTelegram('editMessageText', body);
}
