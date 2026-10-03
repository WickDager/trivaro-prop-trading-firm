'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { Button } from '@/components/ui/button';
import { CryptoSelector } from '@/components/payment/CryptoSelector';
import { TelegramRedirect } from '@/components/payment/TelegramRedirect';
import { CHALLENGE_PRICING } from '@/lib/constants';
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

/** Networks whose verifier is actually implemented. Offering a network the
 *  payment verifier cannot check would take the customer's money and never
 *  credit the order, so the others are shown as unavailable rather than
 *  silently accepted. */
const VERIFIABLE_NETWORKS = new Set(['TRC20']);

export function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { supabase } = useSupabase();

  const sizeParam = Number(searchParams.get('size'));
  const [selectedSize, setSelectedSize] = useState<number | null>(
    CHALLENGE_PRICING.some((p) => p.accountSize === sizeParam) ? sizeParam : null,
  );
  const [challengeType, setChallengeType] = useState<ChallengeType>('equity');
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [status, setStatus] = useState<'idle' | 'creating' | 'pending' | 'paid' | 'expired'>('idle');
  const [startingTrial, setStartingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedPricing = CHALLENGE_PRICING.find((p) => p.accountSize === selectedSize);

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
        toast.success('Payment received — your challenge is being set up.');
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
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start your trial');
    } finally {
      setStartingTrial(false);
    }
  }

  async function createOrder() {
    if (!selectedSize || !selectedNetwork) return;
    setStatus('creating');
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Preserve the selection through the login round-trip.
        const next = `/challenges?size=${selectedSize}`;
        router.push(`/login?redirect=${encodeURIComponent(next)}`);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc('create_order', {
        p_account_size: selectedSize,
        p_challenge_type: challengeType,
        p_network: selectedNetwork,
      });

      if (rpcError) {
        setError(rpcError.message);
        setStatus('idle');
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError('Could not create your order. Please try again.');
        setStatus('idle');
        return;
      }

      setOrder(row as CreatedOrder);
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
              Equity challenges have no minimum trading days and a lower fee.
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
                        {challenge.minTradingDays} Min Trading Days
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
                <p className="mb-2 text-sm text-text-secondary">Select cryptocurrency</p>
                <CryptoSelector
                  enabledNetworks={VERIFIABLE_NETWORKS}
                  selected={selectedNetwork ? `USDT-${selectedNetwork}` : undefined}
                  onSelect={(opt) => setSelectedNetwork(opt.network)}
                />
                <p className="mt-3 text-xs text-text-muted">
                  More networks are added once their payment verification is live — we would rather
                  not accept a payment we cannot confirm.
                </p>

                {selectedNetwork && (
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
                      Your challenge is being created. It will appear on your dashboard shortly.
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
                      <p className="mt-1 font-mono text-2xl font-bold text-teal-400">
                        {Number(order.crypto_amount).toFixed(2)} USDT
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        on {order.network} — the exact amount identifies your payment
                      </p>
                    </div>

                    <div className="mt-4 flex justify-center rounded-lg bg-white p-3">
                      <QRCodeSVG value={order.wallet_address} size={160} level="M" />
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
