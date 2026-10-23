// ============================================================================
// supabase/functions/_shared/security.ts
//
// Security helpers shared by the Trivaro edge functions.
//
// Imported by relative path (`../_shared/security.ts`) so it needs no
// import-map entry, and it deliberately has ZERO imports of its own — it adds
// nothing to the bare-specifier surface the functions already rely on.
//
// Contents:
//   * timingSafeEqual  — constant-time secret comparison (SHA-256 digest, then
//                        the runtime's timingSafeEqual when it has one and an
//                        XOR fold otherwise — the Deno extension was removed in
//                        Deno 2 and calling it threw)
//   * requireEdgeKey   — shared-secret guard for HTTP-called functions
//   * requireEnv       — explicit env presence check (never `get('X')!`)
//   * json             — JSON response with the right content type
//   * corsHeaders /
//     preflight        — explicit origin allowlist, never `*`
//   * fetchJson        — every outbound fetch gets an 8s abort + res.ok check
//   * fetchText        — same guarantees for endpoints that answer in plain text
//   * decimalToUnits   — exact decimal -> integer conversion (no float math)
//
// ENV VARS read here:
//   ALLOWED_ORIGINS    optional  comma-separated browser origins allowed to
//                                call the HTTP functions. When unset, only
//                                localhost:3000/3001 and *.vercel.app are
//                                allowed. Never a wildcard.
// ============================================================================

/** Every outbound call must finish (or abort) within this budget. */
export const OUTBOUND_TIMEOUT_MS = 8000;

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Constant-time string comparison.
 *
 * Both sides are hashed to a fixed 32 bytes first, so inputs of different
 * lengths are still compared in constant time and `===`-style early exit
 * timing cannot leak the secret.
 *
 * `crypto.subtle.timingSafeEqual` is a Deno EXTENSION, not WebCrypto: Deno 1.x
 * only exposed it behind `--unstable`, and Deno 2 removed it (checked on
 * 2.9.6 — `typeof` is "undefined"). Calling it unguarded is why every
 * shared-secret edge function answered `server_error` on a Deno 2 runtime, so it
 * is used only when the runtime actually has it.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);

  // Cast: `timingSafeEqual` is a Deno extension to SubtleCrypto and is not in
  // the standard DOM typings that some editors fall back to.
  const subtle = crypto.subtle as unknown as {
    timingSafeEqual?(x: ArrayBuffer, y: ArrayBuffer): boolean;
  };
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(digestA, digestB);
  }
  return constantTimeDigestEqual(new Uint8Array(digestA), new Uint8Array(digestB));
}

/**
 * Constant-time equality for two equal-length byte strings.
 *
 * Every byte is XOR-folded into one accumulator with no early exit, so the work
 * done depends only on the (fixed, 32-byte) digest length — never on how many
 * leading bytes two secrets happen to share. Feeding it digests rather than the
 * raw strings is what keeps the length itself out of the timing signal.
 */
function constantTimeDigestEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

/**
 * Guard for the shared `EDGE_FUNCTION_API_KEY`.
 *
 * Returns null when the caller presented the correct secret, otherwise the
 * Response to return immediately. Fails CLOSED when the env var is unset:
 * `Deno.env.get('X')!` is a TypeScript assertion only — at runtime it is
 * `undefined`, and `"Bearer undefined" === "Bearer undefined"` would pass.
 */
export async function requireEdgeKey(
  req: Request,
  cors: Record<string, string> = {},
): Promise<Response | null> {
  const edgeKey = Deno.env.get('EDGE_FUNCTION_API_KEY');
  if (!edgeKey) {
    console.error('FATAL: EDGE_FUNCTION_API_KEY is not set — refusing all requests');
    return json({ error: 'server_misconfigured' }, 500, cors);
  }
  const auth = req.headers.get('authorization') ?? '';
  if (!(await timingSafeEqual(auth, `Bearer ${edgeKey}`))) {
    return json({ error: 'unauthorized' }, 401, cors);
  }
  return null;
}

/** Explicit presence check. Returns null when the variable is unset/empty. */
export function requireEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.length > 0 ? value : null;
}

/** Parse a named key from Supabase's platform-provided JSON key map. */
export function parseSupabaseSecretKey(
  rawKeys: string | undefined,
  keyName = 'default',
): string | null {
  if (!rawKeys) return null;

  try {
    const keys: unknown = JSON.parse(rawKeys);
    if (typeof keys !== 'object' || keys === null || Array.isArray(keys)) return null;
    const key = (keys as Record<string, unknown>)[keyName];
    return typeof key === 'string' && key.startsWith('sb_secret_') ? key : null;
  } catch {
    console.error('SUPABASE_SECRET_KEYS is not valid JSON');
    return null;
  }
}

/**
 * Read a named Supabase Secret key from the platform-provided JSON map.
 * Reject non-secret values so an accidental publishable key cannot create an
 * admin client that silently loses its required privileges.
 */
export function getSupabaseSecretKey(
  keyName = Deno.env.get('EDGE_SUPABASE_SECRET_KEY_NAME')?.trim() || 'default',
): string | null {
  return parseSupabaseSecretKey(Deno.env.get('SUPABASE_SECRET_KEYS'), keyName);
}

const LOCAL_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];
const VERCEL_PREVIEW = /^https:\/\/[a-z0-9][a-z0-9-]*\.vercel\.app$/i;

let allowedOriginsCache: string[] | null = null;

function configuredOrigins(): string[] {
  if (allowedOriginsCache !== null) return allowedOriginsCache;
  const parsed: string[] = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin: string) => origin.trim())
    .filter((origin: string) => origin.length > 0);
  allowedOriginsCache = parsed;
  return parsed;
}

/**
 * CORS headers for browser callers, restricted to an explicit allowlist.
 * Never `*`, and never combined with Access-Control-Allow-Credentials —
 * these endpoints authenticate with a bearer secret, not cookies.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!origin) return {};

  const configured = configuredOrigins();
  const allowed = configured.length > 0
    ? configured.includes(origin)
    : LOCAL_ORIGINS.includes(origin) || VERCEL_PREVIEW.test(origin);

  if (!allowed) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Answers a CORS preflight, or returns null when this is not a preflight. */
export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export type FetchJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; error: 'upstream_unavailable' | 'upstream_bad_response' };

/**
 * Outbound GET/POST with an 8s timeout and a `res.ok` check before parsing.
 * Only the host is logged — chain explorers take their API token as a query
 * parameter, so the full URL must never reach the logs.
 */
export async function fetchJson(
  url: string,
  init: RequestInit = {},
): Promise<FetchJsonResult> {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return 'unknown-host';
    }
  })();

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) });
  } catch (error) {
    console.error(`upstream fetch failed (${host}):`, error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: 'upstream_unavailable' };
  }

  if (!res.ok) {
    console.error(`upstream returned ${res.status} (${host})`);
    return { ok: false, error: 'upstream_unavailable' };
  }

  try {
    return { ok: true, data: await res.json() };
  } catch (error) {
    // A slow upstream can answer the headers and then be cut off by the 8s
    // abort while the body is still arriving; that is a TIMEOUT, not malformed
    // JSON, and reporting it as the latter sends the operator looking for a
    // response-shape bug that does not exist.
    const aborted = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error(
      aborted
        ? `upstream timed out reading the body (${host}, ${OUTBOUND_TIMEOUT_MS}ms)`
        : `upstream returned invalid JSON (${host})`,
    );
    return { ok: false, error: aborted ? 'upstream_unavailable' : 'upstream_bad_response' };
  }
}

/**
 * Outbound GET for endpoints that answer in plain text rather than JSON —
 * Esplora's `/blocks/tip/height` is a bare number, so `res.json()` would throw
 * and the chain tip (and therefore every confirmation count) would be lost.
 * Same 8s abort and `res.ok` check as fetchJson.
 */
export async function fetchText(
  url: string,
  init: RequestInit = {},
): Promise<FetchJsonResult & { data?: string }> {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return 'unknown-host';
    }
  })();

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) });
  } catch (error) {
    console.error(`upstream fetch failed (${host}):`, error instanceof Error ? error.name : 'unknown');
    return { ok: false, error: 'upstream_unavailable' };
  }

  if (!res.ok) {
    console.error(`upstream returned ${res.status} (${host})`);
    return { ok: false, error: 'upstream_unavailable' };
  }

  try {
    return { ok: true, data: await res.text() };
  } catch {
    console.error(`upstream body could not be read (${host})`);
    return { ok: false, error: 'upstream_bad_response' };
  }
}

/**
 * Exact decimal -> integer conversion.
 *
 * `0.045` at 6 decimals becomes `45000n`. Uses string maths (never
 * float subtraction / `Math.abs(a - b) < 0.01`) so amounts cannot drift.
 * Returns null when the value is missing or not a plain decimal number.
 */
export function decimalToUnits(value: unknown, decimals: number): bigint | null {
  if (value === null || value === undefined) return null;

  let text = String(value).trim();
  if (text.length === 0) return null;

  // Postgres numeric_out never uses exponent notation, but a JSON number can
  // arrive as 1e-8 — normalise before the exact parse.
  if (/e/i.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return null;
    text = numeric.toFixed(decimals);
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const [whole, fraction = ''] = text.split('.');
  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Normalise a PostgREST `.select()` result to a single row (or null).
 *
 * Use this instead of `.maybeSingle()` on anything that is not a plain SELECT.
 * postgrest-js 1.x gates the single-row unwrap on `method === 'GET'`, so an
 * `update(...).select('id').maybeSingle()` that matched ZERO rows resolves to
 * `[]` — and `[]` is truthy, which makes `if (!claimed)` silently treat a
 * failed write as a success. Extra rows are logged rather than ignored.
 */
export function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) {
    if (data.length > 1) console.error(`expected at most one row, got ${data.length}`);
    return (data[0] as T | undefined) ?? null;
  }
  if (data !== null && typeof data === 'object') return data as T;
  return null;
}

/** |actual - expected| <= tolerance, in integer units. */
export function withinTolerance(
  actual: bigint,
  expected: bigint,
  tolerance: bigint,
): boolean {
  const delta = actual > expected ? actual - expected : expected - actual;
  return delta <= tolerance;
}
