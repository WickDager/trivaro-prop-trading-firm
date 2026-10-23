import { parseSupabaseSecretKey } from './security.ts';

Deno.test('selects the default named secret key', () => {
  const key = parseSupabaseSecretKey('{"default":"sb_secret_default"}');
  if (key !== 'sb_secret_default') throw new Error('default key was not selected');
});

Deno.test('selects a configured named secret key', () => {
  const key = parseSupabaseSecretKey(
    '{"default":"sb_secret_default","bridge":"sb_secret_bridge"}',
    'bridge',
  );
  if (key !== 'sb_secret_bridge') throw new Error('named key was not selected');
});

Deno.test('rejects publishable keys for privileged clients', () => {
  const key = parseSupabaseSecretKey('{"default":"sb_publishable_public"}');
  if (key !== null) throw new Error('publishable key was accepted as a secret');
});

Deno.test('fails closed for missing or malformed secret maps', () => {
  if (parseSupabaseSecretKey(undefined) !== null) {
    throw new Error('missing map was accepted');
  }
  if (parseSupabaseSecretKey('{not-json') !== null) {
    throw new Error('malformed map was accepted');
  }
});