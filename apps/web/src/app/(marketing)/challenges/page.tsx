'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { CryptoSelector } from '@/components/payment/CryptoSelector';
import { TelegramRedirect } from '@/components/payment/TelegramRedirect';
import { CHALLENGE_PRICING } from '@/lib/constants';
import { Check, Info } from 'lucide-react';

export default function ChallengesPage() {
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const selectedPricing = CHALLENGE_PRICING.find((p) => p.accountSize === selectedSize);

  function handleStartPayment() {
    const id = `TV-2026-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    setPaymentId(id);
  }

  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">
              Choose Your <GradientText as="span">Challenge</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Select your account size and start your journey to becoming a funded trader
            </p>
          </div>
        </RevealOnScroll>

        {!paymentId && (
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {CHALLENGE_PRICING.map((challenge) => (
              <motion.div
                key={challenge.accountSize}
                whileHover={{ y: -5 }}
                onClick={() => setSelectedSize(challenge.accountSize)}
                className={`cursor-pointer rounded-xl border p-6 transition-all ${
                  selectedSize === challenge.accountSize
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
                    {challenge.profitTarget}% Target
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    {challenge.maxDrawdown}% Drawdown
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-400">${challenge.equityChallenge}</p>
                <p className="text-xs text-text-muted">one-time fee</p>
              </motion.div>
            ))}
          </div>
        )}

        {selectedSize && !paymentId && (
          <RevealOnScroll>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-16 max-w-lg"
            >
              <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
                <h2 className="mb-6 font-heading text-xl font-semibold">Payment Method</h2>
                <div className="mb-6">
                  <p className="mb-2 text-sm text-text-secondary">Select cryptocurrency</p>
                  <CryptoSelector
                    selected={selectedCrypto ?? undefined}
                    onSelect={(opt) => setSelectedCrypto(`${opt.currency}-${opt.network}`)}
                  />
                </div>

                {selectedCrypto && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-navy-800 p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Challenge Fee</span>
                        <span className="font-semibold">${selectedPricing?.equityChallenge}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-text-secondary">Payout</span>
                        <span className="font-semibold text-green-400">Up to 90%</span>
                      </div>
                    </div>

                    <GlowButton className="w-full" size="lg" onClick={handleStartPayment}>
                      Pay with Crypto
                    </GlowButton>
                  </div>
                )}
              </div>
            </motion.div>
          </RevealOnScroll>
        )}

        {paymentId && (
          <RevealOnScroll>
            <div className="mx-auto mt-16 max-w-md text-center">
              <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
                <h2 className="mb-4 font-heading text-xl font-semibold text-green-400">
                  Order Created
                </h2>
                <p className="mb-6 text-sm text-text-secondary">
                  Your payment ID: <code className="font-mono text-teal-400">{paymentId}</code>
                </p>
                <TelegramRedirect paymentId={paymentId} />
                <p className="mt-4 text-xs text-text-muted">
                  Complete payment within 30 minutes via the Telegram bot
                </p>
              </div>
            </div>
          </RevealOnScroll>
        )}
      </div>
    </div>
  );
}
