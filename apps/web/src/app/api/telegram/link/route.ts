// ============================================================================
// /api/telegram/link — mint / read / revoke the customer's Telegram link.
//
// WHY A LINK INSTEAD OF A USERNAME FIELD
//   A typed @handle proves nothing: Telegram usernames are optional, mutable,
//   and easy to mistype or impersonate. This route mints a single-use token
//   that only the signed-in customer can start, and the bot webhook binds the
//   numeric Telegram `from.id` of whoever redeems it. That is the only
//   identifier Telegram guarantees and the only one the bot can trust.
//
//   GET     → current link state (from the cookie session, never a query param)
//   POST    → { url } deep link, valid 10 minutes, one active token per user
//   DELETE  → unlink; clears telegram_id/telegram_username on the own profile
//
// Every response is `no-store` and same-origin guarded: the token in the URL is
// a bearer capability for one account.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { createServerClient, createServiceClient } from '@/lib/supabase';
import { isSameOrigin, PRIVATE_NO_STORE } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Long enough that a leaked link is useless, short enough to stay usable. */
const TOKEN_TTL_MS = 10 * 60 * 1000;

/** Telegram start payload: 1-64 chars of A-Z a-z 0-9 _ -.
 *  `link_` + 48 hex chars = 53, comfortably inside the limit.
 *
 *  Hex, not base64url: base64url mixes cases, and Telegram's start payload is
 *  not documented as case-preserving end to end. Losing the case of a token
 *  would make every link unredeemable, and a lowercase token space costs
 *  nothing (48 hex chars = 192 bits of entropy). */
const PAYLOAD_PREFIX = 'link_';
const TOKEN_BYTES = 24;

const BOT_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

function botUsername(): string | null {
  const raw =
    process.env.TELEGRAM_BOT_USERNAME ??
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
    '';
  const name = raw.trim().replace(/^@/, '');
  // A malformed value would silently produce a dead t.me link, so fail loudly
  // instead of sending the customer to a 404.
  return BOT_USERNAME_RE.test(name) ? name : null;
}

/** Identical to the digest the webhook computes before redeeming. */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function requireUser(request: NextRequest) {
  const { supabase } = createServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, linked: false },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_username')
    .eq('id', user.id)
    .maybeSingle<{ telegram_username: string | null }>();

  if (error) {
    console.error('telegram link status failed:', error.code);
    return NextResponse.json(
      { ok: false, linked: false },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }

  const username = data?.telegram_username ?? null;
  return NextResponse.json(
    { ok: true, linked: Boolean(username), username },
    { headers: PRIVATE_NO_STORE },
  );
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden_origin' },
      { status: 403, headers: PRIVATE_NO_STORE },
    );
  }

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  const bot = botUsername();
  if (!bot) {
    console.error('TELEGRAM_BOT_USERNAME is missing or malformed');
    return NextResponse.json(
      { ok: false, error: 'telegram_not_configured' },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }

  const supabase = createServiceClient();

  // One outstanding token per account: a second request invalidates the first,
  // so a link the customer abandoned cannot be redeemed later.
  const { error: clearError } = await supabase
    .from('telegram_link_tokens')
    .delete()
    .eq('user_id', user.id)
    .is('used_at', null);

  if (clearError) {
    console.error('telegram link cleanup failed:', clearError.code);
    return NextResponse.json(
      { ok: false, error: 'link_unavailable' },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }

  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { error: insertError } = await supabase
    .from('telegram_link_tokens')
    .insert({ token_hash: hashToken(token), user_id: user.id, expires_at: expiresAt });

  if (insertError) {
    console.error('telegram link token insert failed:', insertError.code);
    return NextResponse.json(
      { ok: false, error: 'link_unavailable' },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }

  // The raw token leaves the server exactly once, in this URL. It is never
  // logged, and the database only holds its SHA-256.
  return NextResponse.json(
    {
      ok: true,
      url: `https://t.me/${bot}?start=${PAYLOAD_PREFIX}${token}`,
      expires_at: expiresAt,
    },
    { headers: PRIVATE_NO_STORE },
  );
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden_origin' },
      { status: 403, headers: PRIVATE_NO_STORE },
    );
  }

  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('profiles')
    .update({ telegram_id: null, telegram_username: null, telegram_linked_at: null })
    .eq('id', user.id);

  if (error) {
    console.error('telegram unlink failed:', error.code);
    return NextResponse.json(
      { ok: false, error: 'unlink_failed' },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }

  // Pending invitations die with the link.
  await supabase
    .from('telegram_link_tokens')
    .delete()
    .eq('user_id', user.id)
    .is('used_at', null);

  return NextResponse.json({ ok: true, linked: false }, { headers: PRIVATE_NO_STORE });
}
