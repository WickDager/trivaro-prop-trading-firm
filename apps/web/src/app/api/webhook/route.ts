import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

/**
 * Constant-time comparison over equal-length digests. A plain `!==` short
 * circuits on the first differing byte, leaking length and prefix. Mirrors
 * `timingSafeEqual` in supabase/functions/_shared/security.ts, which every
 * edge function already uses.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return nodeTimingSafeEqual(digestA, digestB);
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; username?: string };
    text?: string;
    from?: { id: number; username?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}

const ipRequests = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    }

    // Fail CLOSED. This previously read `if (TELEGRAM_WEBHOOK_SECRET) { ... }`,
    // so an unset/empty env var skipped authentication entirely and the
    // endpoint accepted any POST. Every edge function in this project fails
    // closed in the same situation (see _shared/security.ts: requireEdgeKey).
    if (!TELEGRAM_WEBHOOK_SECRET) {
      console.error('webhook misconfigured: TELEGRAM_WEBHOOK_SECRET is not set');
      return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
    }

    const token = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (!timingSafeEqual(token, TELEGRAM_WEBHOOK_SECRET)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const text = await request.text();
    let update: TelegramUpdate;
    try {
      update = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    }

    if (update.message?.text) {
      const chatId = update.message.chat.id;
      const messageText = update.message.text;

      if (messageText.startsWith('/start')) {
        const payload = messageText.split(' ')[1] ?? '';
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not configured');

        const paymentId = payload.replace('order_', '');

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Welcome to Trivaro!\n\nOrder: ${paymentId.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')}\n\nSend your payment to the following address:`,
            parse_mode: 'Markdown',
          }),
        });

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
