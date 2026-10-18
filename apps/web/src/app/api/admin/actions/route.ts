// ============================================================================
// /api/admin/actions — every privileged admin write, in one audited place.
//
// Why an API route instead of typing the writes into the pages:
//   * `admin_audit_log` is insertable by service_role only, so a browser write
//     could never leave a trail — and the Overview dashboard reads that trail.
//   * Several targets (certificates, app_config, notification_log) have no
//     admin write policy at all.
//   * Validation that matters (role choices, challenge statuses, wallet address
//     formats) must not be enforceable only on the client.
//
// Privileges: cookie session + profiles.role = 'admin', re-checked here on every
// request. The customer client never calls this route.
// ============================================================================

import { NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase';
import { isSameOrigin } from '@/lib/security';
import type { NextRequest } from 'next/server';

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const ROLES = ['trader', 'admin', 'reviewer'] as const;
const KYC_STATUSES = ['pending', 'verified', 'rejected'] as const;
// 'cancelled' was added to the CHECK constraint in migration 013.
const ORDER_STATUSES = ['pending', 'paid', 'expired', 'failed', 'refunded', 'cancelled'] as const;
const CHALLENGE_STATUSES = [
  'trial',
  'active',
  'phase1_complete',
  'phase2_complete',
  'reviewing',
  'funded',
  'passed',
  'failed',
] as const;

/** Hot wallet rotation is a real admin job; the key allow-list is what stops a
 *  typo from pointing checkout at an attacker's address silently. */
const WALLET_KEYS: Record<string, RegExp> = {
  hot_wallet_trc20: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  hot_wallet_erc20: /^0x[0-9a-fA-F]{40}$/,
  hot_wallet_btc: /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
  // Pinned token contracts. The TRC20 slot is USDT and the ERC20 slot is
  // Circle's USDC: the verifier matches these addresses exactly, so editing one
  // changes which token counts as a payment on that rail.
  usdt_trc20_contract: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  usdc_erc20_contract: /^0x[0-9a-fA-F]{40}$/,
};

interface Body {
  action?: unknown;
  [key: string]: unknown;
}

function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function jsonError(error: string, status: number, hint?: string) {
  return NextResponse.json(hint ? { error, hint } : { error }, { status });
}

export async function POST(request: NextRequest) {
  // Same-origin guard: this route authenticates with cookies, so a foreign
  // page must not be able to drive it even with a valid session in the browser.
  if (!isSameOrigin(request)) return jsonError('forbidden_origin', 403);

  const { supabase, supabaseResponse } = createServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError('unauthorized', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return jsonError('forbidden', 403);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return jsonError('invalid_json', 400);
  }

  const admin = createServiceClient();
  // Captured once: TypeScript cannot carry the `!user` narrowing into the
  // nested helpers below.
  const adminId = user.id;
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;

  async function audit(
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown>,
  ) {
    const { error } = await admin.from('admin_audit_log').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
      ip_address: ip,
    });
    // An action that succeeded but failed to audit is still a success for the
    // operator; log loudly rather than rolling back a real state change.
    if (error) console.error('admin_audit_log insert failed:', error.code);
  }

  const action = str(body.action, 40);
  const done = (payload: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: true, action, ...payload });

  try {
    switch (action) {
      // ---- People ---------------------------------------------------------
      case 'set_role': {
        const userId = str(body.user_id, 40);
        const role = str(body.role, 20);
        if (!UUID_RE.test(userId)) return jsonError('invalid_user_id', 400);
        if (!ROLES.includes(role as (typeof ROLES)[number])) return jsonError('invalid_role', 400);
        // Self-demotion would lock the only signed-in admin out of this panel.
        if (userId === adminId) return jsonError('cannot_change_own_role', 400);

        if (role !== 'admin') {
          const { count } = await admin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('role', 'admin');
          if ((count ?? 0) <= 1) return jsonError('last_admin', 409, 'Promote another admin first.');
        }

        const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
        if (error) return jsonError('update_failed', 500);
        await audit('user_role_change', 'user', userId, { from: 'unknown', to: role });
        return done({ user_id: userId, role });
      }

      case 'set_kyc': {
        const userId = str(body.user_id, 40);
        const status = str(body.status, 20);
        if (!UUID_RE.test(userId)) return jsonError('invalid_user_id', 400);
        if (!KYC_STATUSES.includes(status as (typeof KYC_STATUSES)[number])) {
          return jsonError('invalid_kyc_status', 400);
        }
        const { error } = await admin.from('profiles').update({ kyc_status: status }).eq('id', userId);
        if (error) return jsonError('update_failed', 500);
        await audit(status === 'verified' ? 'kyc_approve' : status === 'rejected' ? 'kyc_reject' : 'kyc_reset', 'user', userId, {
          status,
          note: str(body.note, 500) || null,
        });
        return done({ user_id: userId, kyc_status: status });
      }

      // ---- Payments -------------------------------------------------------
      case 'order_status': {
        const orderId = str(body.order_id, 40);
        const status = str(body.status, 20);
        if (!UUID_RE.test(orderId)) return jsonError('invalid_order_id', 400);
        if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) {
          return jsonError('invalid_order_status', 400);
        }

        const { data: order, error: readError } = await admin
          .from('orders')
          .select('id,status,user_id,account_size')
          .eq('id', orderId)
          .maybeSingle();
        if (readError) return jsonError('order_lookup_failed', 500);
        if (!order) return jsonError('order_not_found', 404);

        // `create_challenge_from_order` only fires on pending → paid. Marking a
        // late payment (expired/failed) as paid would otherwise credit an order
        // with no challenge behind it, so step it through pending first.
        if (status === 'paid' && order.status !== 'pending') {
          const { error: resetError } = await admin
            .from('orders')
            .update({ status: 'pending' })
            .eq('id', orderId);
          if (resetError) return jsonError('update_failed', 500);
        }

        const patch: { status: string; paid_at?: string; verified_at?: string } = { status };
        if (status === 'paid') {
          patch.paid_at = new Date().toISOString();
          patch.verified_at = new Date().toISOString();
        }
        const { error } = await admin.from('orders').update(patch).eq('id', orderId);
        if (error) return jsonError('update_failed', 500);

        await audit('order_status_change', 'order', orderId, {
          from: order.status,
          to: status,
          note: str(body.note, 500) || null,
        });

        // A paid order now has a challenge with no credential requirement set;
        // queue it so it reaches the provisioning list.
        let challengeId: string | null = null;
        if (status === 'paid') {
          const { data: challenge } = await admin
            .from('challenges')
            .select('id,credential_status')
            .eq('order_id', orderId)
            .maybeSingle();
          if (challenge) {
            challengeId = challenge.id;
            if (challenge.credential_status === 'none') {
              await admin.from('challenges').update({ credential_status: 'pending' }).eq('id', challenge.id);
            }
          }
        }

        return done({ order_id: orderId, status, challenge_id: challengeId });
      }

      case 'order_verify_chain': {
        // Admin-side re-check of an on-chain payment. The customer endpoint
        // (/api/orders/status) is scoped to the caller's own orders, so an
        // admin reviewing someone else's payment needs this path.
        const orderId = str(body.order_id, 40);
        if (!UUID_RE.test(orderId)) return jsonError('invalid_order_id', 400);

        const { data: order } = await admin
          .from('orders')
          .select('id,payment_id,status,network,crypto_currency,crypto_amount')
          .eq('id', orderId)
          .maybeSingle();
        if (!order) return jsonError('order_not_found', 404);

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.EDGE_FUNCTION_API_KEY;
        if (!url || !key) return jsonError('verifier_not_configured', 500, 'SUPABASE_URL / EDGE_FUNCTION_API_KEY missing.');

        const res = await fetch(`${url}/functions/v1/verify-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ payment_id: order.payment_id }),
          signal: AbortSignal.timeout(20_000),
          cache: 'no-store',
        }).catch(() => null);

        if (!res) return jsonError('verifier_unreachable', 502);
        const verifier = (await res.json().catch(() => ({}))) as { verified?: boolean; reason?: string };

        // The verifier owns the write; re-read rather than trusting its body.
        const { data: updated } = await admin
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .maybeSingle();

        await audit('order_verify_chain', 'order', orderId, {
          verifier_status: res.status,
          verified: verifier.verified ?? false,
          reason: verifier.reason ?? null,
          status_after: updated?.status ?? order.status,
        });

        return done({
          order_id: orderId,
          status: updated?.status ?? order.status,
          verified: verifier.verified ?? false,
          reason: verifier.reason ?? null,
        });
      }

      // ---- Accounts / challenges -----------------------------------------
      case 'challenge_status': {
        const challengeId = str(body.challenge_id, 40);
        const status = str(body.status, 20);
        if (!UUID_RE.test(challengeId)) return jsonError('invalid_challenge_id', 400);
        if (!CHALLENGE_STATUSES.includes(status as (typeof CHALLENGE_STATUSES)[number])) {
          return jsonError('invalid_challenge_status', 400);
        }

        const { data: challenge } = await admin
          .from('challenges')
          .select('id,status,is_trial')
          .eq('id', challengeId)
          .maybeSingle();
        if (!challenge) return jsonError('challenge_not_found', 404);

        // Migration 016: a free trial is never eligible for funding or payout.
        if (challenge.is_trial && (status === 'funded' || status === 'passed')) {
          return jsonError('trial_not_fundable', 409, 'A practice trial can only be failed or left running.');
        }

        const { error } = await admin.from('challenges').update({ status }).eq('id', challengeId);
        if (error) return jsonError('update_failed', 500);
        await audit('challenge_status_change', 'challenge', challengeId, {
          from: challenge.status,
          to: status,
          note: str(body.note, 500) || null,
        });
        return done({ challenge_id: challengeId, status });
      }

      case 'challenge_extend_trial': {
        const challengeId = str(body.challenge_id, 40);
        const days = Number(body.days);
        if (!UUID_RE.test(challengeId)) return jsonError('invalid_challenge_id', 400);
        if (!Number.isFinite(days) || days < 1 || days > 60) return jsonError('invalid_days', 400);

        const { data: challenge } = await admin
          .from('challenges')
          .select('id,is_trial,trial_ends_at')
          .eq('id', challengeId)
          .maybeSingle();
        if (!challenge) return jsonError('challenge_not_found', 404);
        if (!challenge.is_trial) return jsonError('not_a_trial', 409);

        const base = challenge.trial_ends_at ? new Date(challenge.trial_ends_at) : new Date();
        const from = base.getTime() > Date.now() ? base : new Date();
        const next = new Date(from.getTime() + days * 86_400_000).toISOString();

        const { error } = await admin.from('challenges').update({ trial_ends_at: next }).eq('id', challengeId);
        if (error) return jsonError('update_failed', 500);
        await audit('trial_extended', 'challenge', challengeId, { days, trial_ends_at: next });
        return done({ challenge_id: challengeId, trial_ends_at: next });
      }

      case 'challenge_authorize': {
        // Authorising = this account is cleared to trade, so its MT5 account
        // must be provisioned. Moves the row into the provisioning queue.
        const challengeId = str(body.challenge_id, 40);
        if (!UUID_RE.test(challengeId)) return jsonError('invalid_challenge_id', 400);
        const { data: challenge } = await admin
          .from('challenges')
          .select('id,credential_status')
          .eq('id', challengeId)
          .maybeSingle();
        if (!challenge) return jsonError('challenge_not_found', 404);
        if (challenge.credential_status && challenge.credential_status !== 'none') {
          return done({ challenge_id: challengeId, credential_status: challenge.credential_status, unchanged: true });
        }
        const { error } = await admin.from('challenges').update({ credential_status: 'pending' }).eq('id', challengeId);
        if (error) return jsonError('update_failed', 500);
        await audit('account_authorized', 'challenge', challengeId, { credential_status: 'pending' });
        return done({ challenge_id: challengeId, credential_status: 'pending' });
      }

      case 'credentials_send': {
        const challengeId = str(body.challenge_id, 40);
        if (!UUID_RE.test(challengeId)) return jsonError('invalid_challenge_id', 400);

        const { data: challenge } = await admin
          .from('challenges')
          .select('id,order_id,credential_status')
          .eq('id', challengeId)
          .maybeSingle();
        if (!challenge) return jsonError('challenge_not_found', 404);
        if (!challenge.order_id) return jsonError('no_order_linked', 409, 'This account has no paid order to deliver against.');
        if (challenge.credential_status !== 'provisioned') {
          return jsonError('credentials_not_ready', 409, 'Save the MT5 credentials first.');
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.EDGE_FUNCTION_API_KEY;
        if (!url || !key) return jsonError('delivery_not_configured', 500, 'SUPABASE_URL / EDGE_FUNCTION_API_KEY missing.');

        const res = await fetch(`${url}/functions/v1/send-credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ order_id: challenge.order_id }),
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        }).catch(() => null);

        if (!res) return jsonError('delivery_unreachable', 502);
        if (!res.ok) {
          const detail = (await res.json().catch(() => ({}))) as { error?: string };
          const hint =
            detail.error === 'no_telegram_chat_bound'
              ? 'The customer has not started the Telegram bot, so there is no chat to deliver to.'
              : detail.error === 'credentials_under_review'
                ? 'The database still reports the credentials as unprovisioned.'
                : undefined;
          return jsonError(detail.error ?? 'delivery_failed', res.status === 409 ? 409 : 502, hint);
        }

        await audit('credentials_sent', 'challenge', challengeId, { order_id: challenge.order_id });
        return done({ challenge_id: challengeId, delivered: true });
      }

      // ---- Certificates ---------------------------------------------------
      case 'certificate_issue': {
        const challengeId = str(body.challenge_id, 40);
        if (!UUID_RE.test(challengeId)) return jsonError('invalid_challenge_id', 400);

        const { data: challenge } = await admin
          .from('challenges')
          .select('id,user_id,status,starting_balance,is_trial,created_at')
          .eq('id', challengeId)
          .maybeSingle();
        if (!challenge) return jsonError('challenge_not_found', 404);
        if (!challenge.user_id) return jsonError('challenge_has_no_owner', 409);
        if (challenge.is_trial) return jsonError('trial_not_certifiable', 409);
        if (!['funded', 'passed', 'phase2_complete'].includes(challenge.status)) {
          return jsonError('challenge_not_passed', 409, 'Only a passed or funded account can be certified.');
        }

        const { data: existing } = await admin
          .from('certificates')
          .select('id,certificate_number')
          .eq('challenge_id', challengeId)
          .maybeSingle();
        if (existing) return done({ certificate: existing, unchanged: true });

        const { data: profile } = await admin
          .from('profiles')
          .select('full_name,first_name,last_name,email')
          .eq('id', challenge.user_id)
          .maybeSingle();
        const traderName =
          profile?.full_name?.trim() ||
          [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
          profile?.email?.split('@')[0] ||
          'Trivaro Trader';

        // Sequential per calendar year, derived from what already exists.
        const year = new Date().getFullYear();
        const { count } = await admin
          .from('certificates')
          .select('id', { count: 'exact', head: true })
          .like('certificate_number', `TRV-${year}-%`);
        const certificateNumber = `TRV-${year}-${String((count ?? 0) + 1).padStart(5, '0')}`;

        const { data: created, error } = await admin
          .from('certificates')
          .insert({
            user_id: challenge.user_id,
            challenge_id: challengeId,
            certificate_number: certificateNumber,
            trader_name: traderName,
            account_size: Number(challenge.starting_balance) || 0,
            completion_date: new Date().toISOString(),
            status: 'issued',
            issued_by: adminId,
          })
          .select('id,certificate_number')
          .single();
        if (error) return jsonError('certificate_insert_failed', 500);

        await audit('certificate_issue', 'challenge', challengeId, { certificate_number: certificateNumber });
        return done({ certificate: created });
      }

      case 'certificate_revoke': {
        const certificateId = str(body.certificate_id, 40);
        if (!UUID_RE.test(certificateId)) return jsonError('invalid_certificate_id', 400);
        const { error } = await admin
          .from('certificates')
          .update({ status: 'revoked', revoked_at: new Date().toISOString() })
          .eq('id', certificateId);
        if (error) return jsonError('update_failed', 500);
        await audit('certificate_revoke', 'certificate', certificateId, { note: str(body.note, 500) || null });
        return done({ certificate_id: certificateId });
      }

      // ---- Notifications --------------------------------------------------
      case 'notification_retry': {
        const notificationId = str(body.notification_id, 40);
        if (!UUID_RE.test(notificationId)) return jsonError('invalid_notification_id', 400);

        const { data: row } = await admin
          .from('notification_log')
          .select('*')
          .eq('id', notificationId)
          .maybeSingle();
        if (!row) return jsonError('notification_not_found', 404);

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.EDGE_FUNCTION_API_KEY;
        if (!url || !key) return jsonError('delivery_not_configured', 500, 'SUPABASE_URL / EDGE_FUNCTION_API_KEY missing.');

        // send-notification is a database-webhook receiver: it expects the same
        // INSERT envelope Supabase sends, so replaying the stored row is a
        // genuine retry rather than a second, parallel code path.
        const res = await fetch(`${url}/functions/v1/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ type: 'INSERT', table: 'notification_log', record: row }),
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        }).catch(() => null);

        const ok = !!res?.ok;
        await admin
          .from('notification_log')
          .update({
            status: ok ? 'sent' : 'failed',
            sent_at: ok ? new Date().toISOString() : row.sent_at,
            error_message: ok ? null : `retry failed (${res ? res.status : 'unreachable'})`,
          })
          .eq('id', notificationId);

        await audit('notification_retry', 'notification', notificationId, { delivered: ok });
        if (!ok) return jsonError('retry_failed', 502);
        return done({ notification_id: notificationId });
      }

      // ---- Configuration --------------------------------------------------
      case 'app_config_set': {
        const configKey = str(body.key, 40);
        const value = str(body.value, 200);
        const pattern = WALLET_KEYS[configKey];
        if (!pattern) return jsonError('key_not_allowed', 400);
        if (!pattern.test(value)) {
          return jsonError('invalid_address', 400, `The value does not look like a ${configKey.includes('trc20') || configKey.includes('erc20') ? 'wallet address' : 'address'} for this network.`);
        }

        const { data: previous } = await admin.from('app_config').select('value').eq('key', configKey).maybeSingle();
        const { error } = await admin.from('app_config').upsert(
          { key: configKey, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
        if (error) return jsonError('update_failed', 500);
        await audit('app_config_update', 'config', configKey, { from: previous?.value ?? null, to: value });
        return done({ key: configKey, value });
      }

      default:
        return jsonError('unknown_action', 400);
    }
  } catch (e) {
    console.error('admin action failed:', action, e instanceof Error ? e.message : e);
    return jsonError('internal_error', 500);
  } finally {
    // `createServerClient` may have refreshed the session cookies.
    void supabaseResponse;
  }
}
