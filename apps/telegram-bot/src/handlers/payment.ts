import { sendMessage } from '../services/telegram.ts';

export async function handlePayment(chatId: number, _text: string) {
  await sendMessage(
    chatId,
    '💳 Please use the website to start a payment. Visit our site and select a challenge to get started.',
  );
}
