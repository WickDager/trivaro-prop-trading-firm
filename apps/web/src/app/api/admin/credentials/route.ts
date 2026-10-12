// ============================================================================
// /api/admin/credentials — admin-only MT5 credential provisioning.
//
// Privileges:
//   * MUST be authenticated (cookie session).
//   * MUST be an admin (profiles.role = 'admin' — enforced server-side here,
//     and again in the `set_challenge_credentials` SECURITY DEFINER RPC,
//     which rejects non-admins itself, so there is no single point of trust).
//   * The customer NEVER calls this route — 401/403 otherwise.
//   * Password is set via the DB, but never sent back in the response body,
//     never logged, and never cached.
//
// Actions:
//   POST /api/admin/credentials
//     { challenge_id, account_number, account_password, server, note? }
//     → provisions or rotates real MT5 credentials.
//     → marks credential_status='provisioned', writes admin_credential_audit.
//
//   POST with `{ action: 'requeue', challenge_id }`
//     → sends back to the pending queue (e.g. broker rejected the account).
//
// No GETs: read access comes through the admin pages using the cookie client.
// ============================================================================

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { NextRequest } from 'next/server';

// TV- prefix + 6-10 unambiguous chars (matches set_challenge_credentials).
const ACCOUNT_NUMBER_RE = /^TV-[A-Z0-9]{6,10}$/;
const SERVER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,64}$/;

interface CredentialBody {
  action?: 'provision' | 'rotate' | 'requeue';
  challenge_id?: unknown;
  account_number?: unknown;
  account_password?: unknown;
  server?: unknown;
  note?: unknown;
}

export async function POST(request: NextRequest) {
  // Auth: cookie session, admin-only.
  const { supabase, supabaseResponse } = createServerClient(request);
  let response = supabaseResponse;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    // Do not reveal whether the challenge exists — prevents a member from
    // probing. Fail generic.
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: CredentialBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const challengeId = typeof body.challenge_id === 'string' ? body.challenge_id.trim() : '';
  const action = body.action === 'requeue' ? 'requeue' : body.action === 'rotate' ? 'rotate' : 'provision';
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;

  if (!/^[0-9a-fA-F-]{36}$/.test(challengeId)) {
    return NextResponse.json({ error: 'invalid_challenge_id' }, { status: 400 });
  }

  // Use the service-level client for writes to avoid RLS recursion issues
  // (is_admin() reads profiles; with the up-to-date policies an admin session
  // passes anyway, but the RPC function verifies admin independently).
  // The generated Database types do not know migration 020's RPCs yet, so the
  // calls go through a narrowly-typed alias. Types are refreshed by
  // `supabase gen types` after the migration is applied to the target DB.
  const { createServiceClient } = await import('@/lib/supabase');
  const adminClient = createServiceClient() as unknown as {
    rpc: (
      fn: 'set_challenge_credentials' | 'set_challenge_credential_status_pending',
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>;
  };

  if (action === 'requeue') {
    // Send back to pending. credential_status only — never touches creds.
    const { error: requeueError } = await adminClient.rpc('set_challenge_credential_status_pending', {
      p_challenge_id: challengeId,
      p_note: note,
    });

    if (requeueError) {
      console.error('requeue failed:', requeueError.message);
      return NextResponse.json({ error: 'requeue_failed' }, { status: 500 });
    }

    response = NextResponse.json({ ok: true, action: 'requeue' });
    return response;
  }

  // Validate — server-side, never trust the client.
  const accountNumber = typeof body.account_number === 'string' ? body.account_number.trim().toUpperCase() : '';
  const accountPassword = typeof body.account_password === 'string' ? body.account_password.trim() : '';
  const server = typeof body.server === 'string' ? body.server.trim() : '';

  if (!ACCOUNT_NUMBER_RE.test(accountNumber)) {
    return NextResponse.json({
      error: 'invalid_account_number',
      hint: 'Format: TV-XXXXXX (6-10 chars: A-Z, 2-9, no 0/O/1/I/L).',
    }, { status: 400 });
  }
  if (accountPassword.length < 6 || accountPassword.length > 64 || /\s/.test(accountPassword)) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 400 });
  }
  if (!SERVER_RE.test(server)) {
    return NextResponse.json({ error: 'invalid_server' }, { status: 400 });
  }

  // The SECURITY DEFINER RPC `set_challenge_credentials` does its own
  // admin-vs-service_role check (migration 020), so even a compromised admin
  // cookie cannot bypass the DB-side guard for other admins' rows.
  const { error: rpcError } = await adminClient.rpc('set_challenge_credentials', {
    p_challenge_id: challengeId,
    p_account_number: accountNumber,
    p_account_password: accountPassword,
    p_server: server,
    p_action: action,
    p_note: note,
  });

  if (rpcError) {
    // The RPC rejects with 42501 on non-admin callers and P0002 if the
    // challenge id is unknown. Surface generic codes only.
    const isRejection = String(rpcError.code).startsWith('42') || rpcError.code === 'P0002';
    console.error('set_challenge_credentials failed:', isRejection ? rpcError.code : rpcError.message);
    return NextResponse.json({ error: 'provisioning_failed' }, { status: isRejection ? 403 : 500 });
  }

  // The RPC also returns the full challenge row, which may contain the password
  // and `user_id`; we deliberately discard it and return only non-sensitive fields.
  response = NextResponse.json({
    ok: true,
    action,
    challenge_id: challengeId,
    account_number: accountNumber,
    server,
  });
  return response;
}
