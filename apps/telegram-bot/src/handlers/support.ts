import { sendMessage } from '../services/telegram.ts';

export async function handleSupport(chatId: number) {
  const msg = [
    `🤖 <b>Trivaro Bot Help</b>`,
    '',
    `<b>/start</b> — Start payment for an order`,
    `<b>/help</b> — Show this message`,
    `<b>/support</b> — Contact human support`,
    '',
    `📧 Email: support@trivaro.com`,
    `💬 Telegram: @TrivaroSupport`,
  ].join('\n');

  await sendMessage(chatId, msg, 'HTML');
}
