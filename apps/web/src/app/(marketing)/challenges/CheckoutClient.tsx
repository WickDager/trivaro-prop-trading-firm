'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { Button } from '@/components/ui/button';
import { CryptoSelector } from '@/components/payment/CryptoSelector';
import { TelegramRedirect } from '@/components/payment/TelegramRedirect';
import {
  CHALLENGE_PRICING,
  SUPPORTED_CRYPTO,
  cryptoAssetKey,
  findCryptoAsset,
  type CryptoAsset,
} from '@/lib/constants';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from '@/components/ui/toast';
import { Loader2, Check, Shield, Lock, Clock, Copy, Gift } from 'lucide-react';

type ChallengeType = 'balance' | 'equity';

interface CreatedOrder {
  order_id: string;
  payment_id: string;
  amount_usd: number;
  crypto_amount: number;
  wallet_address: string;
  network: string;
  expires_at: string;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

interface PaymentMethod {
  currency: string;
  network: string;
  label: string;
  ready: boolean;
  reason: string | null;
  /** 1 for the stablecoin rails; the live BTC/USD quote otherwise. */
  rate?: number | null;
  minConfirmations?: number;
}

/** Rendering fallback for an order whose asset cannot be resolved: USDT-TRC20,
 *  the rail every order created before multi-asset checkout was on. */
const FALLBACK_ASSET = findCryptoAsset('USDT', 'TRC20') as CryptoAsset;

export function CheckoutClient() {
  const router = useRouter();
  const { supabase } = useSupabase();

  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [challengeType, setChallengeType] = useState<ChallengeType>('equity');
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset | null>(null);
  // Which rails the server says are payable right now (deposit address +
  // verifier configured). Empty until it answers, which keeps every non-TRC20
  // option disabled rather than optimistically enabled.
  const [readyKeys, setReadyKeys] = useState<ReadonlySet<string>>(new Set());
  const [methodReasons, setMethodReasons] = useState<Record<string, string | null>>({});
  // Published quote per rail, used to show a BTC estimate before an order
  // exists. Never used to compute the amount the customer is asked to send —
  // that comes from the order, which the server priced.
  const [methodRates, setMethodRates] = useState<Record<string, number | null>>({});
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [status, setStatus] = useState<'idle' | 'creating' | 'pending' | 'paid' | 'expired'>('idle');
  const [startingTrial, setStartingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedPricing = CHALLENGE_PRICING.find((p) => p.accountSize === selectedSize);

  /**
   * The asset being paid with: the live selection, which is also the rail the
   * order was created for.
   *
   * This used to fall back to `findCryptoAsset('USDT', order.network)`, which
   * is wrong for every order that is not USDT — a USDC-ERC20 or BTC order had
   * no match for "USDT on that network" and was labelled `USDT` with the wrong
   * number of decimals while the customer was counting out the amount.
   */
  const payAsset: CryptoAsset = selectedAsset ?? FALLBACK_ASSET;

  const selectedKey = selectedAsset
    ? cryptoAssetKey(selectedAsset.currency, selectedAsset.network)
    : null;
  const selectedRate = selectedKey ? methodRates[selectedKey] ?? null : null;
  const selectedPrice = selectedPricing
    ? challengeType === 'balance'
      ? selectedPricing.balanceChallenge
      : selectedPricing.equityChallenge
    : null;
  /** Indicative only — the payable amount is the one the order carries. */
  const estimate =
    selectedAsset?.rateConfigKey && selectedRate && selectedPrice
      ? selectedPrice / selectedRate
      : null;

  // `?size=25000` deep-links straight to an account size. Applied after mount
  // from window.location rather than with `useSearchParams()`: that hook opts
  // the page out of static prerendering, which shipped production a /challenges
  // whose HTML was only a spinner — no <h1>, no pricing, nothing to paint or
  // index until the client bundle landed.
  useEffect(() => {
    const sizeParam = Number(new URLSearchParams(window.location.search).get('size'));
    if (CHALLENGE_PRICING.some((p) => p.accountSize === sizeParam)) setSelectedSize(sizeParam);
  }, []);

  // Poll the order so the page reflects payment without a manual refresh.
  const refreshStatus = useCallback(async (paymentId: string) => {
    try {
      const res = await fetch(`/api/orders/status?payment_id=${encodeURIComponent(paymentId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { status?: string };
      if (data.status === 'paid') {
        setStatus('paid');
        toast.success('Payment received — your account is under review, details to follow by email within 24 hours.');
      } else if (data.status === 'expired') {
        setStatus('expired');
      }
    } catch {
      // Transient network failure — the next tick retries.
    }
  }, []);

  useEffect(() => {
    if (!order || status === 'paid' || status === 'expired') return;
    const id = setInterval(() => void refreshStatus(order.payment_id), 15_000);
    return () => clearInterval(id);
  }, [order, status, refreshStatus]);

  // Ask the server which crypto rails are payable. Availability cannot be
  // decided in the browser: it depends on the verifier's API key and on the
  // deposit address stored in app_config.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function loadMethods() {
      let body: { methods?: PaymentMethod[] } | null = null;
      try {
        const res = await fetch('/api/payments/methods', { cache: 'no-store' });
        if (res.ok) body = (await res.json()) as { methods?: PaymentMethod[] };
      } catch {
        // Retried below; a single failure must not decide what is offered.
      }
      if (cancelled) return;

      if (!body?.methods) {
        attempts += 1;
        if (attempts < 3) {
          timer = setTimeout(() => void loadMethods(), attempts * 1_500);
          return;
        }
        // Say so out loud. Failing quietly left every rail showing "Coming
        // soon", which reads as "we do not accept that" — a live Bitcoin rail
        // looked unavailable because of one dropped request.
        const unavailable: Record<string, string | null> = {};
        for (const asset of SUPPORTED_CRYPTO) {
          unavailable[cryptoAssetKey(asset.currency, asset.network)] =
            'Could not check availability — reload the page';
        }
        setMethodReasons(unavailable);
        return;
      }

      const ready = new Set<string>();
      const reasons: Record<string, string | null> = {};
      const rates: Record<string, number | null> = {};
      let awaitingPrice = false;
      for (const method of body.methods) {
        const key = cryptoAssetKey(method.currency, method.network);
        if (method.ready) ready.add(key);
        reasons[key] = method.reason;
        rates[key] = typeof method.rate === 'number' ? method.rate : null;
        if (!method.ready && /price feed/i.test(method.reason ?? '')) awaitingPrice = true;
      }
      setReadyKeys(ready);
      setMethodReasons(reasons);
      setMethodRates(rates);

      // The Bitcoin rail fetches its price on the read that finds it stale, so
      // one retry is usually enough to turn it on without a reload.
      if (awaitingPrice && timer === null) {
        timer = setTimeout(() => void loadMethods(), 2_500);
      }
    }

    void loadMethods();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function startTrial() {
    setStartingTrial(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/challenges');
        return;
      }
      const { error: rpcError } = await supabase.rpc('start_trial');
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      toast.info('Trial started — MT5 credentials are under review and will arrive by email within 24 hours.');
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start your trial');
    } finally {
      setStartingTrial(false);
    }
  }

  /**
   * Order creation goes through the server, not straight to the RPC.
   *
   * A BTC invoice has to be converted from a USD rate, and the rate may only
   * come from the server (see /api/orders/create). The endpoint also tells us
   * when the price feed is unavailable, which is a "try again shortly" — never
   * a made-up amount.
   */
  async function createOrder() {
    if (!selectedSize || !selectedAsset) return;
    setStatus('creating');
    setError(null);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          account_size: selectedSize,
          challenge_type: challengeType,
          network: selectedAsset.network,
          currency: selectedAsset.currency,
        }),
      });

      if (res.status === 401) {
        // Preserve the selection through the login round-trip.
        const next = `/challenges?size=${selectedSize}`;
        router.push(`/login?redirect=${encodeURIComponent(next)}`);
        setStatus('idle');
        return;
      }

      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; order?: CreatedOrder; detail?: string }
        | null;

      if (!res.ok || !body?.ok || !body.order) {
        setError(body?.detail ?? 'Could not create your order. Please try again.');
        setStatus('idle');
        return;
      }

      setOrder(body.order);
      setStatus('pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your order');
      setStatus('idle');
    }
  }

  async function copyAddress() {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — please select the address manually.');
    }
  }

  return (
    <div className="min-h-dvh pt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-3xl font-bold sm:text-5xl">
              Choose Your <GradientText as="span">Challenge</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Select your account size and start your journey to becoming a funded trader
            </p>
          </div>
        </RevealOnScroll>

        {error && (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-2xl rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        {/* ---- Free trial ------------------------------------------------ */}
        {!order && (
          <RevealOnScroll>
            <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-green-400/30 bg-green-500/5 p-6 text-center sm:p-8">
              <Gift className="mx-auto mb-3 h-8 w-8 text-green-400" />
              <h2 className="font-heading text-xl font-semibold">Try it free for 14 days</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">
                A full $10,000 practice account on the same rules and the same dashboard. No card,
                no payment. Pass it and we&apos;ll show you what a funded account would pay.
              </p>
              <Button
                variant="outline"
                size="lg"
                className="mt-5"
                onClick={startTrial}
                disabled={startingTrial}
              >
                {startingTrial ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                  </>
                ) : (
                  'Start free trial'
                )}
              </Button>
            </div>
          </RevealOnScroll>
        )}

        {/* ---- Account size ---------------------------------------------- */}
        {!order && (
          <>
            <div className="mt-12 flex justify-center">
              <div
                role="radiogroup"
                aria-label="Challenge type"
                className="inline-flex rounded-xl border border-teal-500/10 bg-navy-700/60 p-1"
              >
                {(['equity', 'balance'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={challengeType === t}
                    onClick={() => setChallengeType(t)}
                    className={`min-h-10 rounded-lg px-5 text-sm font-medium capitalize transition-colors ${
                      challengeType === t
                        ? 'bg-teal-500 text-navy-900'
                        : 'text-text-secondary hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-text-muted">
              Every challenge follows the same rules — equity challenges simply carry a lower fee.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CHALLENGE_PRICING.map((challenge) => {
                const price =
                  challengeType === 'balance' ? challenge.balanceChallenge : challenge.equityChallenge;
                const isSelected = selectedSize === challenge.accountSize;
                return (
                  <button
                    key={challenge.accountSize}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedSize(challenge.accountSize)}
                    className={`rounded-xl border p-6 text-left transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'border-teal-400 bg-teal-500/10 shadow-lg shadow-teal-glow'
                        : 'border-teal-500/10 bg-navy-700/60 hover:border-teal-500/30'
                    }`}
                  >
                    <p className="text-sm text-text-muted">Account</p>
                    <p className="font-heading text-2xl font-bold">
                      ${(challenge.accountSize / 1000).toFixed(0)}K
                    </p>
                    <div className="my-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Check className="h-4 w-4 text-green-400" />
                        {challenge.profitTarget}% Profit Target
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Check className="h-4 w-4 text-green-400" />
                        {challenge.maxDrawdown}% Max Drawdown
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <Check className="h-4 w-4 text-green-400" />
                        Min. {challenge.minTradingDays} Trading Days
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{usd.format(price)}</p>
                    <p className="text-xs text-text-muted">one-time fee</p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ---- Payment method -------------------------------------------- */}
        {selectedSize && !order && (
          <RevealOnScroll>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-16 max-w-lg"
            >
              <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 sm:p-8">
                <h2 className="mb-6 font-heading text-xl font-semibold">Payment Method</h2>
                <p className="mb-3 text-sm text-text-secondary">Select cryptocurrency</p>
                <CryptoSelector
                  readyKeys={readyKeys.size ? readyKeys : undefined}
                  reasons={methodReasons}
                  selected={selectedAsset ? cryptoAssetKey(selectedAsset.currency, selectedAsset.network) : undefined}
                  onSelect={setSelectedAsset}
                />

                {selectedAsset && (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-lg bg-navy-800 p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">
                          {challengeType === 'balance' ? 'Balance' : 'Equity'} challenge
                        </span>
                        <span className="font-semibold">
                          {usd.format(
                            challengeType === 'balance'
                              ? selectedPricing?.balanceChallenge ?? 0
                              : selectedPricing?.equityChallenge ?? 0,
                          )}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between gap-3 text-sm">
                        <span className="text-text-secondary">Paying with</span>
                        <span className="text-right font-semibold">
                          {selectedAsset.currency} on {selectedAsset.networkLabel}
                        </span>
                      </div>
                      {estimate !== null && (
                        <div className="mt-2 flex justify-between gap-3 text-sm">
                          <span className="text-text-secondary">Amount</span>
                          <span className="text-right font-semibold">
                            ≈ {estimate.toFixed(selectedAsset.decimals)} {selectedAsset.currency}
                            <span className="ml-1 font-normal text-text-muted">
                              @ {usd.format(selectedRate ?? 0)}/BTC
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-text-secondary">Payout</span>
                        <span className="font-semibold text-green-400">Up to 90%</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3 text-green-400" /> SSL Encrypted
                      </span>
                      <span className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-green-400" /> Secure Payment
                      </span>
                    </div>

                    <GlowButton
                      className="w-full"
                      size="lg"
                      onClick={createOrder}
                      disabled={status === 'creating'}
                    >
                      {status === 'creating' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating order…
                        </>
                      ) : (
                        'Pay with Crypto'
                      )}
                    </GlowButton>
                  </div>
                )}
              </div>
            </motion.div>
          </RevealOnScroll>
        )}

        {/* ---- Pay ------------------------------------------------------- */}
        {order && (
          <RevealOnScroll>
            <div className="mx-auto mt-16 max-w-md">
              <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 sm:p-8">
                {status === 'paid' ? (
                  <div className="text-center">
                    <Check className="mx-auto mb-3 h-10 w-10 text-green-400" />
                    <h2 className="font-heading text-xl font-semibold text-green-400">
                      Payment confirmed
                    </h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      Your purchase is under review. Your MT5 account details
                      will be sent to your email within 24 hours — nothing
                      further is needed from you right now.
                    </p>
                    <p className="mt-2 text-xs text-text-muted">
                      You can watch the status on your dashboard; our team
                      verifies every order before issuing live accounts.
                    </p>
                    <Button className="mt-6 w-full" size="lg" onClick={() => router.push('/dashboard')}>
                      Go to dashboard
                    </Button>
                  </div>
                ) : status === 'expired' ? (
                  <div className="text-center">
                    <Clock className="mx-auto mb-3 h-10 w-10 text-amber-400" />
                    <h2 className="font-heading text-xl font-semibold">Order expired</h2>
                    <p className="mt-2 text-sm text-text-secondary">
                      This payment window closed. You can start a new order — nothing was charged.
                    </p>
                    <Button
                      className="mt-6 w-full"
                      size="lg"
                      onClick={() => {
                        setOrder(null);
                        setStatus('idle');
                      }}
                    >
                      Start a new order
                    </Button>
                  </div>
                ) : (
                  <>
                    <h2 className="mb-1 text-center font-heading text-xl font-semibold">
                      Complete your payment
                    </h2>
                    <p className="mb-6 text-center text-xs text-text-muted">
                      Order <code className="font-mono text-teal-400">{order.payment_id}</code>
                    </p>

                    <div className="rounded-lg bg-navy-800 p-4 text-center">
                      <p className="text-xs text-text-muted">Send exactly</p>
                      <p className="mt-1 break-all font-mono text-2xl font-bold text-teal-400">
                        {Number(order.crypto_amount).toFixed(payAsset.decimals)} {payAsset.currency}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        on {order.network} — the exact amount identifies your payment. Sending a different amount or
                        using another network means we cannot match it to your order.
                      </p>
                    </div>

                    <div className="mt-4 flex justify-center rounded-lg bg-white p-3">
                      {/* For Bitcoin the QR is a BIP21 URI WITH the amount, so a
                          wallet prefills the exact satoshi figure the order
                          needs — the amount is what identifies the payment,
                          and a BTC confirmation is too slow to guess at. */}
                      <QRCodeSVG
                        value={
                          order.network === 'BTC'
                            ? `bitcoin:${order.wallet_address}?amount=${Number(order.crypto_amount).toFixed(8)}`
                            : order.wallet_address
                        }
                        size={160}
                        level="M"
                      />
                    </div>

                    <div className="mt-4 rounded-lg bg-navy-800 p-4">
                      <p className="text-xs text-text-muted">To this address</p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-secondary">
                          {order.wallet_address}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={copyAddress}
                          aria-label="Copy deposit address"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6">
                      <TelegramRedirect paymentId={order.payment_id} />
                    </div>

                    <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting for your payment — this page updates automatically
                    </p>
                    <p className="mt-2 text-center text-[11px] text-text-muted">
                      Credited after {payAsset.minConfirmations} confirmations
                      {order.network === 'BTC'
                        ? ' — a Bitcoin block takes about 10 minutes, so expect up to 30.'
                        : ' (a few seconds to a minute).'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </RevealOnScroll>
        )}
      </div>
    </div>
  );
}
