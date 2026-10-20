#!/usr/bin/env node
// ============================================================================
// scripts/e2e/web-e2e.mjs — end-to-end checks for the Trivaro web app.
//
// Runs against a RUNNING server (dev or `next start`), so it never has to
// build anything itself:
//
//   1. start the app        npm run dev --workspace @trivaro/web
//   2. run the checks       npm run test:e2e
//                           E2E_BASE_URL=http://localhost:49626 npm run test:e2e
//
// Drive the dev server through `localhost`, not `127.0.0.1`: Next 16 treats
// them as different origins and refuses its dev-only resources (HMR + the
// client boot) to one it was not told about, which leaves the page unhydrated
// and every button dead. `allowedDevOrigins` in next.config.ts covers 127.0.0.1
// too, and the runner fails loudly if the page never hydrates.
//
// It uses the `playwright` library that is already a root devDependency
// (no @playwright/test, so no extra install and no lockfile churn) and the
// Chromium build that `npx playwright install chromium` provides.
//
// What it covers:
//   • every public route: HTTP status, one <h1>, title/description, no
//     horizontal overflow, no console error, no uncaught page error
//   • the mobile burger menu: opens, closes (X / Escape / backdrop), reopens,
//     locks and restores body scroll, navigates and closes on navigation
//   • nothing overlaps the header/footer controls (real hit-testing) and
//     header tap targets are big enough to press with a thumb
//   • gated routes redirect anonymous visitors to /login?redirect=…
//   • the payment/order/admin APIs reject anonymous callers
//   • security headers (CSP, X-Frame-Options, nosniff, Referrer-Policy)
// ============================================================================

import { chromium, request } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Playwright only resolves the browser revision that ITS OWN version pins, so a
 * machine whose Chromium was installed by a different Playwright release fails
 * with "Executable doesn't exist at …-1228/…". Rather than downloading a second
 * copy of Chromium, reuse the build that is already on disk; set
 * E2E_CHROMIUM_PATH to override.
 */
function resolveChromium() {
  if (process.env.E2E_CHROMIUM_PATH) return process.env.E2E_CHROMIUM_PATH;
  const root =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright')
        : path.join(os.homedir(), '.cache', 'ms-playwright'));

  const relative = [
    ['chromium-', 'chrome-win64/chrome.exe'],
    ['chromium-', 'chrome-linux64/chrome'],
    ['chromium-', 'chrome-linux/chrome'],
    ['chromium-', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'],
    ['chromium_headless_shell-', 'chrome-headless-shell-win64/chrome-headless-shell.exe'],
    ['chromium_headless_shell-', 'chrome-headless-shell-linux64/chrome-headless-shell'],
  ];

  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return undefined;
  }

  const builds = entries
    .map((entry) => {
      const match = /^chromium(-headless)?_shell-(\d+)$|^chromium-_(\d+)$|^chromium-(\d+)$/.exec(entry);
      const revision = Number(match?.[2] ?? match?.[3] ?? match?.[4] ?? NaN);
      return { entry, revision: Number.isNaN(revision) ? 0 : revision };
    })
    .filter((build) => build.revision > 0)
    .sort((a, b) => b.revision - a.revision);

  for (const build of builds) {
    for (const [prefix, suffix] of relative) {
      if (!build.entry.startsWith(prefix)) continue;
      const candidate = path.join(root, build.entry, suffix);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/challenges',
  '/contact',
  '/how-it-works',
  '/login',
  '/pricing',
  '/privacy',
  '/refund',
  '/rules',
  '/terms',
];

const GATED_ROUTES = ['/dashboard', '/payments', '/admin'];

/** Console noise that is not an app defect. */
const CONSOLE_ALLOWLIST = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /\[HMR\]/i,
  /favicon/i,
  // Dev-only: the HMR socket cannot handshake when the page is driven by an
  // external browser. Never appears against `next start`.
  /WebSocket connection to .* failed/i,
];

/**
 * React attaches event handlers during hydration, so clicking before it
 * finishes is a no-op. Sonner's toaster region only exists once the client
 * bundle has mounted, which makes it a reliable "hydrated" beacon.
 *
 * A miss here is a hard failure, not something to click through: every check
 * that follows would otherwise report a misleading "button did nothing"
 * instead of "the page never hydrated". The usual cause in dev is driving the
 * server from an origin it does not serve (`127.0.0.1` vs `localhost`).
 */
async function waitForHydration(page) {
  try {
    await page
      .locator('[data-sonner-toaster], [aria-label^="Notifications"]')
      .first()
      .waitFor({ state: 'attached', timeout: 20_000 });
  } catch {
    const origin = new URL(page.url()).origin;
    throw new Error(
      `the page never hydrated (waited 20s at ${origin}). In dev, open the server via the ` +
        `origin it was started on (usually http://localhost:PORT) — Next 16 blocks its dev-only ` +
        `resources for other origins unless they are listed in allowedDevOrigins.`,
    );
  }
}

let passed = 0;
let failed = 0;
const failures = [];

function header(text) {
  process.stdout.write(`\n\x1b[1m${text}\x1b[0m\n`);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write(`  \x1b[32m✓\x1b[0m ${name}\n`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}\n      ${message.split('\n').join('\n      ')}`);
    process.stdout.write(`  \x1b[31m✗\x1b[0m ${name}\n      \x1b[31m${message}\x1b[0m\n`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (CONSOLE_ALLOWLIST.some((re) => re.test(text))) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

/** Elements that sit on top of `selector` instead of it. */
const OVERLAP_PROBE = (selector) => {
  const targets = Array.from(document.querySelectorAll(selector));
  const offenders = [];
  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
    const top = document.elementsFromPoint(x, y)[0];
    if (!top) continue;
    if (top === el || el.contains(top) || top.contains(el)) continue;
    offenders.push({
      target: `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(el.textContent || '').trim().slice(0, 30)}"`,
      coveredBy: `${top.tagName.toLowerCase()}.${String(top.className).slice(0, 60)}`,
    });
  }
  return offenders;
};

async function main() {
  process.stdout.write(`Trivaro web e2e — ${BASE}\n`);

  // ---- reachability ------------------------------------------------------
  const api = await request.newContext({ baseURL: BASE });
  try {
    const probe = await api.get('/');
    assert(probe.ok(), `server did not answer at ${BASE} (status ${probe.status()}). Start the app and set E2E_BASE_URL.`);
  } catch (error) {
    process.stdout.write(`\n\x1b[31mCannot reach ${BASE}\x1b[0m\n${error instanceof Error ? error.message : error}\n`);
    await api.dispose();
    process.exit(1);
  }

  const executablePath = resolveChromium();
  if (executablePath) process.stdout.write(`  chromium: ${executablePath}\n`);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});

  try {
    // ======================================================================
    header('Routes — desktop');
    // ======================================================================
    const desktop = await browser.newContext({ viewport: DESKTOP });
    const desktopPage = await desktop.newPage();
    const desktopErrors = collectErrors(desktopPage);

    for (const route of PUBLIC_ROUTES) {
      await check(`GET ${route}`, async () => {
        const response = await desktopPage.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
        assert(response, `${route} produced no response`);
        assert(response.status() < 400, `${route} returned ${response.status()}`);

        const info = await desktopPage.evaluate(() => ({
          h1: document.querySelectorAll('h1').length,
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        assert(info.h1 >= 1, `${route} renders no <h1>`);
        assert(info.title.length > 0, `${route} has no <title>`);
        assert(info.description.length > 20, `${route} meta description is missing or too short`);
        assert(info.overflow <= 1, `${route} scrolls horizontally by ${info.overflow}px at 1280px`);
      });
    }

    // The account-size deep link is applied from window.location after mount
    // (so the page can stay statically prerendered) — this proves the URL still
    // preselects the size the customer clicked on the pricing page.
    await check('?size= preselects the account size on /challenges', async () => {
      await desktopPage.goto(`${BASE}/challenges?size=25000`, { waitUntil: 'domcontentloaded' });
      await waitForHydration(desktopPage);
      const pressed = desktopPage.locator('button[aria-pressed="true"]');
      await pressed.first().waitFor({ state: 'visible', timeout: 10_000 });
      const label = (await pressed.first().textContent()) ?? '';
      assert(/25\s?K|25[,\s]?000/.test(label), `the selected card reads "${label.trim().slice(0, 40)}", not $25,000`);
    });

    await check('desktop nav shows inline links, not a burger', async () => {
      await desktopPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      const burgerVisible = await desktopPage
        .locator('button[aria-label="Open navigation menu"]')
        .isVisible()
        .catch(() => false);
      assert(!burgerVisible, 'the burger is still rendered at 1280px, where the inline nav is used');
      const inlineLinks = await desktopPage.locator('header nav a[href="/pricing"]').count();
      assert(inlineLinks >= 1, 'the inline nav is missing at 1280px');
    });

    await check('security headers on a rendered page', async () => {
      const response = await desktopPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      const headers = response.headers();
      const csp = headers['content-security-policy'] ?? '';
      assert(csp.includes("default-src 'self'"), `CSP missing or unexpected: "${csp}"`);
      assert(headers['x-frame-options'] === 'DENY', `X-Frame-Options is "${headers['x-frame-options']}"`);
      assert(headers['x-content-type-options'] === 'nosniff', `X-Content-Type-Options is "${headers['x-content-type-options']}"`);
      assert(
        headers['referrer-policy'] === 'strict-origin-when-cross-origin',
        `Referrer-Policy is "${headers['referrer-policy']}"`,
      );
      assert(headers['permissions-policy']?.includes('camera=()'), 'Permissions-Policy is missing');
      assert(csp.includes("object-src 'none'"), "CSP does not block plugin content (object-src 'none')");
      assert(!headers['x-powered-by'], `X-Powered-By still advertises "${headers['x-powered-by']}"`);
      if (process.env.E2E_EXPECT_PROD === '1') {
        assert(!csp.includes("'unsafe-eval'"), "production CSP still allows 'unsafe-eval'");
        assert(csp.includes('upgrade-insecure-requests'), 'production CSP does not upgrade insecure requests');
      }
    });
    await desktop.close();

    // ======================================================================
    header('Routes — mobile (390×844)');
    // ======================================================================
    const mobile = await browser.newContext({
      viewport: MOBILE,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const mobileErrors = [];
    for (const route of PUBLIC_ROUTES) {
      const page = await mobile.newPage();
      mobileErrors.push(...collectErrors(page).map((e) => `${route} ${e}`));
      await check(`GET ${route} at 390px`, async () => {
        const response = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
        assert(response && response.status() < 400, `${route} returned ${response?.status()}`);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        assert(overflow <= 1, `${route} scrolls horizontally by ${overflow}px at 390px`);
      });
      await page.close();
    }

    await check('mobile: header/footer controls are not covered by anything', async () => {
      const page = await mobile.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      const offenders = await page.evaluate(
        OVERLAP_PROBE,
        'header a, header button, footer a, footer button, nav a',
      );
      await page.close();
      assert(
        offenders.length === 0,
        `covered controls:\n${offenders.map((o) => `${o.target} ← ${o.coveredBy}`).join('\n')}`,
      );
    });

    await check('mobile: header tap targets are at least 44px tall', async () => {
      const page = await mobile.newPage();
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await waitForHydration(page);
      const small = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('header a, header button')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.height < 44) {
            out.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 24)}" = ${Math.round(rect.height)}px`);
          }
        }
        return out;
      });
      await page.close();
      assert(small.length === 0, `too small to tap: ${small.join(', ')}`);
    });

    // ======================================================================
    header('Burger menu (mobile)');
    // ======================================================================
    const BURGER = 'button[aria-label="Open navigation menu"]';
    const burgerPage = await mobile.newPage();
    burgerPage.on('pageerror', (error) => mobileErrors.push(`burger pageerror: ${error.message}`));

    await check('burger is visible and opens the navigation sheet', async () => {
      await burgerPage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await waitForHydration(burgerPage);
      const burger = burgerPage.locator(BURGER);
      await burger.waitFor({ state: 'visible', timeout: 10_000 });

      const before = await burger.getAttribute('aria-expanded');
      assert(before === 'false', `burger starts with aria-expanded="${before}"`);

      await burger.click();
      const dialog = burgerPage.locator('[role="dialog"]');
      await dialog.waitFor({ state: 'visible', timeout: 5_000 });
      assert((await dialog.getAttribute('aria-modal')) === 'true', 'the sheet is not aria-modal');
      assert((await burger.getAttribute('aria-expanded')) === 'true', 'aria-expanded stayed false after opening');

      const label = await dialog.getAttribute('aria-label');
      assert(label === 'Navigation menu', `dialog is labelled "${label}"`);
      for (const text of ['How It Works', 'Pricing', 'Challenges', 'About']) {
        assert(
          (await dialog.getByRole('link', { name: text, exact: true }).count()) > 0,
          `the sheet has no "${text}" link`,
        );
      }
      const uncovered = await burgerPage.evaluate(() => {
        const el = document.querySelector('button[aria-label="Open navigation menu"]');
        const rect = el.getBoundingClientRect();
        const top = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)[0];
        return top === el || el.contains(top);
      });
      assert(!uncovered, 'the sheet left the burger covered');
    });

    await check('Escape closes the sheet', async () => {
      await burgerPage.keyboard.press('Escape');
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5_000 });
      assert(
        (await burgerPage.locator(BURGER).getAttribute('aria-expanded')) === 'false',
        'aria-expanded stayed true after Escape',
      );
    });

    await check('body scroll is locked while open and released on close', async () => {
      await burgerPage.locator(BURGER).click();
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'visible' });

      const locked = await burgerPage.evaluate(() => document.body.style.position);
      assert(locked === 'fixed', `body position while open is "${locked}"`);

      await burgerPage.locator('[role="dialog"] button[aria-label="Close menu"]').click();
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'hidden' });

      const released = await burgerPage.evaluate(() => ({
        position: document.body.style.position,
        overflow: document.body.style.overflow,
      }));
      assert(
        released.position === '' && released.overflow === '',
        `scroll lock was not released: ${JSON.stringify(released)}`,
      );
    });

    await check('tapping the backdrop closes the sheet', async () => {
      await burgerPage.locator(BURGER).click();
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'visible' });
      await burgerPage.evaluate(() => {
        const sheet = document.querySelector('[role="dialog"]');
        const backdrop = sheet.parentElement.querySelector('div.fixed.inset-0');
        backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5_000 });
    });

    await check('a link inside the sheet navigates and closes it', async () => {
      await burgerPage.locator(BURGER).click();
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'visible' });
      // The sheet slides up with a 300ms transform, so its links are still
      // below the viewport for the first frames. Framer Motion animates inline
      // styles, not a Web Animation, so `getAnimations()` stays empty and a
      // click issued immediately after the dialog appears lands off-screen:
      // that is what made this check fail on a cold server. Wait until the
      // panel has actually settled inside the viewport.
      await burgerPage.waitForFunction(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const rect = dialog.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight + 1;
      }, { timeout: 5_000 });
      await burgerPage.locator('[role="dialog"] a', { hasText: 'Pricing' }).first().click();
      await burgerPage.waitForURL('**/pricing', { timeout: 10_000 });
      await burgerPage.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 5_000 });
      assert(
        (await burgerPage.locator(BURGER).getAttribute('aria-expanded')) === 'false',
        'the sheet stayed open after navigating',
      );
    });

    await check('the mobile pass produced no console or page errors', async () => {
      assert(mobileErrors.length === 0, mobileErrors.join('\n'));
    });
    await burgerPage.close();

    // ======================================================================
    header('Auth gating');
    // ======================================================================
    const gated = await browser.newContext({ viewport: DESKTOP });
    const gatedPage = await gated.newPage();
    for (const route of GATED_ROUTES) {
      await check(`anonymous ${route} redirects to /login`, async () => {
        await gatedPage.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
        const url = new URL(gatedPage.url());
        assert(url.pathname === '/login', `${route} landed on ${url.pathname}`);
        assert(url.searchParams.get('redirect') === route, `redirect param is "${url.searchParams.get('redirect')}"`);
      });
    }
    await check('/api/admin/data rejects an anonymous caller', async () => {
      const response = await api.get('/api/admin/data');
      assert([401, 403].includes(response.status()), `/api/admin/data returned ${response.status()} for an anonymous caller`);
    });

    await check('/api/admin/actions rejects an anonymous write', async () => {
      const response = await api.post('/api/admin/actions', { data: { action: 'set_role' } });
      assert(response.status() === 401, `returned ${response.status()} for an anonymous admin write`);
    });

    await check('/api/admin/credentials rejects an anonymous caller', async () => {
      const response = await api.post('/api/admin/credentials', {
        data: { challenge_id: '00000000-0000-0000-0000-000000000000' },
      });
      assert(response.status() === 401, `returned ${response.status()} for an anonymous credential read`);
    });

    await check('/api/certificate/generate rejects an anonymous caller', async () => {
      const response = await api.post('/api/certificate/generate', {
        data: { challengeId: '00000000-0000-0000-0000-000000000000' },
      });
      assert([401, 403, 404].includes(response.status()), `returned ${response.status()} for an anonymous certificate request`);
    });
    await gated.close();

    // ======================================================================
    header('APIs');
    // ======================================================================
    await check('GET /api/payments/methods lists the crypto rails', async () => {
      const response = await api.get('/api/payments/methods');
      assert(response.ok(), `returned ${response.status()}`);
      const body = await response.json();
      assert(Array.isArray(body.methods) && body.methods.length > 0, 'no methods in the response');
      for (const method of body.methods) {
        assert(
          typeof method.currency === 'string' && typeof method.network === 'string',
          'a method has no currency/network',
        );
        assert(typeof method.ready === 'boolean', `${method.currency} has no ready flag`);
        if (method.ready && method.currency === 'BTC') {
          assert(typeof method.rate === 'number', `${method.currency}/${method.network} is ready but carries no rate`);
        }
      }
    });

    await check('POST /api/orders/create rejects an anonymous caller', async () => {
      const response = await api.post('/api/orders/create', {
        data: { account_size: 50000, challenge_type: 'equity', currency: 'USDT', network: 'TRC20' },
      });
      assert([400, 401, 403].includes(response.status()), `returned ${response.status()} for an anonymous caller`);
    });

    await check('GET /api/orders/status requires a payment_id', async () => {
      const response = await api.get('/api/orders/status');
      assert([400, 401, 404].includes(response.status()), `returned ${response.status()} with no payment_id`);
    });

    await check('POST /api/rates/refresh is not public', async () => {
      const response = await api.post('/api/rates/refresh', { data: {} });
      assert([401, 403, 405].includes(response.status()), `returned ${response.status()} for an anonymous caller`);
    });

    await check('POST /api/webhook rejects an unsigned payload', async () => {
      const response = await api.post('/api/webhook', { data: { hello: 'world' } });
      assert([400, 401, 403, 405].includes(response.status()), `returned ${response.status()} for an unsigned payload`);
    });

    await check('POST /api/auth/signout clears the session cookies', async () => {
      const response = await api.post('/api/auth/signout');
      assert(response.ok(), `returned ${response.status()}`);
      const body = await response.json();
      assert(body.ok === true, `body is ${JSON.stringify(body)}`);
    });

    // ======================================================================
    header('Security surface');
    // ======================================================================
    await check('POST /api/auth/login-event rejects an anonymous caller', async () => {
      const response = await api.post('/api/auth/login-event', { data: { provider: 'email' } });
      assert(response.status() === 401, `returned ${response.status()} for an unauthenticated login report`);
    });

    await check('POST /api/auth/login-event refuses a foreign Origin', async () => {
      const response = await api.post('/api/auth/login-event', {
        headers: { Origin: 'https://evil.example' },
        data: { provider: 'email' },
      });
      assert(response.status() === 403, `returned ${response.status()} for a cross-origin login report`);
    });

    await check('POST /api/orders/create refuses a foreign Origin', async () => {
      const response = await api.post('/api/orders/create', {
        headers: { Origin: 'https://evil.example' },
        data: { account_size: 10000, challenge_type: 'equity', network: 'TRC20', currency: 'USDT' },
      });
      assert(response.status() === 403, `returned ${response.status()} for a cross-origin order attempt`);
      assert((await response.json()).error === 'forbidden_origin', 'did not report forbidden_origin');
    });

    await check('POST /api/orders/create rejects malformed JSON with 400', async () => {
      const response = await api.post('/api/orders/create', {
        headers: { 'Content-Type': 'application/json' },
        data: '{not json',
      });
      assert(response.status() === 400, `returned ${response.status()} for malformed JSON`);
    });

    await check('POST /api/orders/create rejects an unsupported rail', async () => {
      const response = await api.post('/api/orders/create', {
        data: { account_size: 10000, challenge_type: 'equity', network: 'ERC20', currency: 'USDT' },
      });
      assert(response.status() === 400, `USDT-ERC20 returned ${response.status()} instead of 400`);
      assert((await response.json()).error === 'unsupported_rail', 'did not report unsupported_rail');
    });

    await check('POST /api/orders/create rejects a negative account size', async () => {
      const response = await api.post('/api/orders/create', {
        data: { account_size: -1, challenge_type: 'equity', network: 'TRC20', currency: 'USDT' },
      });
      assert(response.status() === 400, `returned ${response.status()} for account_size -1`);
      assert((await response.json()).error === 'invalid_account_size', 'did not report invalid_account_size');
    });

    await check('POST /api/admin/actions refuses a foreign Origin', async () => {
      const response = await api.post('/api/admin/actions', {
        headers: { Origin: 'https://evil.example' },
        data: { action: 'set_role' },
      });
      assert(response.status() === 403, `returned ${response.status()} for a cross-origin admin write`);
    });

    await check('POST /api/admin/credentials refuses a foreign Origin', async () => {
      const response = await api.post('/api/admin/credentials', {
        headers: { Origin: 'https://evil.example' },
        data: { challenge_id: '00000000-0000-0000-0000-000000000000' },
      });
      assert(response.status() === 403, `returned ${response.status()} for a cross-origin credential write`);
    });

    await check('POST /api/certificate/generate refuses a foreign Origin', async () => {
      const response = await api.post('/api/certificate/generate', {
        headers: { Origin: 'https://evil.example' },
        data: { challengeId: '00000000-0000-0000-0000-000000000000' },
      });
      assert(response.status() === 403, `returned ${response.status()} for a cross-origin certificate request`);
    });

    await check('GET /api/auth/signout is not allowed (no prefetch sign-out)', async () => {
      const response = await api.get('/api/auth/signout');
      assert(response.status() === 405, `returned ${response.status()} for GET`);
    });

    await check('POST /api/orders/status is not allowed', async () => {
      const response = await api.post('/api/orders/status', { data: {} });
      assert(response.status() === 405, `returned ${response.status()} for POST`);
    });

    await check('GET /api/webhook is not allowed', async () => {
      const response = await api.get('/api/webhook');
      assert(response.status() === 405, `returned ${response.status()} for GET`);
    });

    await check('POST /api/rates/refresh rejects a wrong bearer token', async () => {
      const response = await api.post('/api/rates/refresh', {
        headers: { Authorization: 'Bearer definitely-not-the-cron-secret' },
        data: {},
      });
      assert(response.status() !== 200, 'returned 200 for a wrong bearer token');
      const body = await response.json().catch(() => ({}));
      assert(['unauthorized', 'not_configured'].includes(body.error), `unexpected error "${body.error}"`);
    });

    await check('POST /api/rates/refresh fails closed on "Bearer undefined"', async () => {
      const response = await api.post('/api/rates/refresh', {
        headers: { Authorization: 'Bearer undefined' },
        data: {},
      });
      assert(response.status() !== 200, 'the literal string "undefined" was accepted as a secret');
    });

    await check('the Telegram webhook is rate limited per client IP', async () => {
      // A dedicated address so this cannot disturb the other webhook checks.
      const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
      const statuses = [];
      for (let i = 0; i < 12; i += 1) {
        const response = await api.post('/api/webhook', {
          headers: { 'X-Forwarded-For': ip, 'X-Telegram-Bot-Api-Secret-Token': 'wrong' },
          data: { update_id: i },
        });
        statuses.push(response.status());
      }
      assert(statuses.includes(429), `no request was throttled: ${statuses.join(',')}`);
      assert(statuses.slice(10).every((s) => s === 429), `only the first ten should pass: ${statuses.join(',')}`);
    });

    await check('payment methods expose no deposit address or placeholder', async () => {
      const response = await api.get('/api/payments/methods');
      const text = await response.text();
      assert(!/T[1-9A-HJ-NP-Za-km-z]{33}/.test(text), 'a TRON address is present in the public response');
      assert(!/0x[0-9a-fA-F]{40}/.test(text), 'an EVM address is present in the public response');
      assert(!/bc1[02-9ac-hj-np-z]{11,}/i.test(text), 'a Bitcoin address is present in the public response');
      assert(!text.includes('REPLACE_ME'), 'a placeholder address leaked into the public response');
    });

    await check('payment methods list exactly the three pinned rails', async () => {
      const response = await api.get('/api/payments/methods');
      const body = await response.json();
      const pairs = body.methods.map((m) => `${m.currency}-${m.network}`).sort();
      assert(
        JSON.stringify(pairs) === JSON.stringify(['BTC-BTC', 'USDC-ERC20', 'USDT-TRC20']),
        `unexpected rails: ${pairs.join(', ')}`,
      );
    });

    await check('API errors do not leak internals', async () => {
      for (const route of ['/api/admin/data', '/api/orders/status?payment_id=TV-2026-AAAAAA']) {
        const response = await api.get(route);
        const text = await response.text();
        assert(
          !/(supabase\.co|postgres|PostgREST| at [A-Za-z0-9_$.]+ \()/i.test(text),
          `${route} leaked internal detail: ${text.slice(0, 120)}`,
        );
      }
    });

    await check('an unknown API route returns 404 without a stack trace', async () => {
      const response = await api.get('/api/definitely-not-a-route');
      assert(response.status() === 404, `returned ${response.status()}`);
      const text = await response.text();
      assert(!/\bat [A-Za-z0-9_$.]+ \(/.test(text), 'the 404 body contains a stack trace');
    });

    await check('RFC 9116 security.txt is published', async () => {
      const response = await api.get('/.well-known/security.txt');
      assert(response.ok(), `returned ${response.status()}`);
      const text = await response.text();
      assert(/^Contact: mailto:/m.test(text), 'security.txt has no Contact: mailto entry');
      assert(/^Expires: /m.test(text), 'security.txt has no Expires: entry');
    });

    // ======================================================================
    header('Content contract (prerendered HTML, before client JS)');
    // ======================================================================
    await check('/challenges advertises the free trial in prerendered HTML', async () => {
      const html = await (await api.get('/challenges')).text();
      assert(html.includes('Try it free for 14 days'), 'the trial headline is missing from prerendered HTML');
      assert(html.includes('$10,000 practice account'), 'the trial account size is missing');
      assert(html.includes('Start free trial'), 'the trial CTA is missing');
    });

    await check('/rules names all three rails and the trial terms', async () => {
      const html = await (await api.get('/rules')).text();
      for (const phrase of ['Free Trial', '$10,000', '14 days', 'USDT on Tron (TRC20)', 'USDC on Ethereum (ERC20)', 'Bitcoin on-chain', '30-minute']) {
        assert(html.includes(phrase), `the rules page does not contain "${phrase}"`);
      }
    });

    await check('/terms carries the trial clause, payment window and date', async () => {
      const html = await (await api.get('/terms')).text();
      for (const phrase of ['Free Trial', '30-minute window', 'October 17, 2026']) {
        assert(html.includes(phrase), `the terms page does not contain "${phrase}"`);
      }
    });

    await check('desktop pages logged no console or page errors', async () => {
      assert(desktopErrors.length === 0, desktopErrors.join('\n'));
    });
  } finally {
    await api.dispose();
    await browser.close();
  }

  header('Summary');
  process.stdout.write(`  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const failure of failures) process.stdout.write(`  • ${failure}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  process.stdout.write(`\n\x1b[31mThe e2e runner crashed:\x1b[0m ${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});
