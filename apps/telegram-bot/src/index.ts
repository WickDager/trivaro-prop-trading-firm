import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleStart } from './handlers/start.ts';
import { handlePayment } from './handlers/payment.ts';
import { handleVerify } from './handlers/verify.ts';
import { handleSupport } from './handlers/support.ts';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; username?: string };
    text?: string;
    from?: { id: number; username?: string };
  };
}

serve(async (req) => {
  try {
    const update: TelegramUpdate = await req.json();
    if (!update.message?.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;
    const username = update.message.from?.username;

    if (text.startsWith('/start')) {
      const payload = text.split(' ')[1] ?? '';
      await handleStart(chatId, payload, username);
    } else if (text.startsWith('/pay')) {
      await handlePayment(chatId, text);
    } else if (text.startsWith('/verify')) {
      await handleVerify(chatId, text);
    } else if (text.startsWith('/help')) {
      await handleSupport(chatId);
    } else {
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: 'Use /start to begin or /help for assistance.',
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Bot error:', error);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
