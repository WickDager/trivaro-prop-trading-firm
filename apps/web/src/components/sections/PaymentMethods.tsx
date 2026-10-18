import Link from 'next/link';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { SUPPORTED_CRYPTO } from '@/lib/constants';
import { Bitcoin, CircleDollarSign, Coins, ShieldCheck } from 'lucide-react';

/**
 * The payment-methods section.
 *
 * Every accepted asset is listed here because the marketing pages used to
 * describe only "USDT on the TRC20 network", while the platform also takes
 * USDC on Ethereum and Bitcoin. The list is generated from SUPPORTED_CRYPTO so
 * it can never drift from what the checkout offers.
 */
const ICONS: Record<string, typeof Coins> = {
  BTC: Bitcoin,
  default: Coins,
};

export function PaymentMethods() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Crypto <GradientText as="span">Payments &amp; Payouts</GradientText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Pay in USDT on Tron, USDC on Ethereum, or in Bitcoin — three rails, each verified on-chain.
              Payouts come back in the same cryptocurrency you bought with, at the same profit split.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SUPPORTED_CRYPTO.map((asset, i) => {
            const Icon = ICONS[asset.currency] ?? ICONS.default;
            return (
              <RevealOnScroll key={`${asset.currency}-${asset.network}`} delay={i * 0.08}>
                <div className="flex h-full flex-col rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 transition-colors hover:border-teal-500/30">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="shrink-0 rounded bg-navy-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      {asset.networkLabel}
                    </span>
                  </div>
                  <h3 className="font-heading text-lg font-semibold">{asset.label}</h3>
                  <p className="mt-1 text-xs text-text-muted">{asset.chain} network</p>
                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-text-muted">Confirmed in</dt>
                      <dd className="text-text-secondary">{asset.speed}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-text-muted">Fees</dt>
                      <dd className="text-text-secondary">{asset.fee}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-text-muted">Payouts</dt>
                      <dd className="text-green-400">Same asset</dd>
                    </div>
                  </dl>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>

        <RevealOnScroll delay={0.2}>
          <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-3 rounded-xl border border-teal-500/10 bg-navy-700/40 p-6 text-center">
            <ShieldCheck className="h-6 w-6 text-teal-400" />
            <p className="text-sm text-text-secondary">
              Every rail is checked on-chain before your account is provisioned. Your deposit address and the exact
              amount are shown at payment time, the order confirms itself, and a rail only appears at checkout once
              its verification is live — we would rather hold an option back than take a payment we cannot confirm.
            </p>
            <p className="flex items-center gap-2 text-xs text-text-muted">
              <CircleDollarSign className="h-3.5 w-3.5" />
              One-time fee · no subscriptions · refundable if you never access Phase 1
            </p>
            <Link href="/challenges" className="text-sm font-medium text-teal-400 hover:underline">
              Start your challenge →
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
