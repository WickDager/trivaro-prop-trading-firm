// ============================================================================
// /api/profile — the customer's own onboarding details.
//
// Why a server route instead of a browser-side update: the profiles table is
// writable by its owner through RLS, but a browser update is an arbitrary
// column set. `role` and `kyc_status` live on the same row, so the whitelist
// has to be enforced somewhere the caller cannot edit — here.
//
// Only fields a customer may legitimately change are accepted. Anything else
// in the body is ignored, and the row is always addressed by the id from the
// verified session, never by a body/query parameter (IDOR).
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase';
import { isSameOrigin, PRIVATE_NO_STORE } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE_RE = /^\+[1-9][0-9]{6,14}$/;
const COUNTRY_RE = /^[A-Z]{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const POSTAL_RE = /^[A-Za-z0-9 -]{3,12}$/;

/** Minimum age for a funded-account product; also blocks accidental 1900s. */
const MIN_AGE = 18;

type Patch = {
  phone_e164?: string | null;
  country_code?: string | null;
  date_of_birth?: string | null;
  address_line1?: string | null;
  city?: string | null;
  postal_code?: string | null;
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: 'forbidden_origin' },
      { status: 403, headers: PRIVATE_NO_STORE },
    );
  }

  const { supabase } = createServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401, headers: PRIVATE_NO_STORE },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400, headers: PRIVATE_NO_STORE },
    );
  }

  const patch: Patch = {};
  const errors: Record<string, string> = {};

  if ('country_code' in body) {
    const raw = text(body.country_code, 2)?.toUpperCase() ?? null;
    if (raw !== null && !COUNTRY_RE.test(raw)) {
      errors.country_code = 'Use a two-letter country code (e.g. GB, US).';
    } else {
      patch.country_code = raw;
    }
  }

  if ('phone_e164' in body) {
    const raw = text(body.phone_e164, 16);
    if (raw !== null && !PHONE_RE.test(raw)) {
      errors.phone_e164 = 'Use international format, e.g. +447700900123.';
    } else {
      patch.phone_e164 = raw;
    }
  }

  if ('date_of_birth' in body) {
    const raw = text(body.date_of_birth, 10);
    if (raw === null) {
      patch.date_of_birth = null;
    } else if (!DATE_RE.test(raw) || Number.isNaN(Date.parse(raw))) {
      errors.date_of_birth = 'Use the YYYY-MM-DD format.';
    } else {
      const dob = new Date(`${raw}T00:00:00Z`);
      const today = new Date();
      const eighteenth = new Date(
        Date.UTC(today.getUTCFullYear() - MIN_AGE, today.getUTCMonth(), today.getUTCDate()),
      );
      if (dob > eighteenth) {
        // Also covers a future date.
        errors.date_of_birth = `You must be at least ${MIN_AGE} to open an account.`;
      } else if (dob.getUTCFullYear() < 1900) {
        errors.date_of_birth = 'Check the year — that date looks wrong.';
      } else {
        patch.date_of_birth = raw;
      }
    }
  }

  if ('address_line1' in body) {
    patch.address_line1 = text(body.address_line1, 120);
  }
  if ('city' in body) {
    patch.city = text(body.city, 80);
  }
  if ('postal_code' in body) {
    const raw = text(body.postal_code, 12);
    if (raw !== null && !POSTAL_RE.test(raw)) {
      errors.postal_code = 'Letters, digits, spaces and hyphens only.';
    } else {
      patch.postal_code = raw;
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json(
      { ok: false, error: 'validation_failed', fields: errors },
      { status: 400, headers: PRIVATE_NO_STORE },
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: 'nothing_to_update' },
      { status: 400, headers: PRIVATE_NO_STORE },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from('profiles').update(patch).eq('id', user.id);

  if (error) {
    console.error('profile update failed:', error.code);
    return NextResponse.json(
      { ok: false, error: 'update_failed' },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }

  return NextResponse.json({ ok: true }, { headers: PRIVATE_NO_STORE });
}
