import { sendMessage } from '../services/telegram.ts';

export async function handleVerify(chatId: number, _text: string) {
  await sendMessage(
    chatId,
    '⏳ Verification is automatic. Your account will be activated within minutes of payment confirmation.',
  );
}
