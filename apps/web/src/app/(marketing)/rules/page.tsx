import type { Metadata } from 'next';
import Link from 'next/link';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Newspaper,
  Bot,
  Gauge,
  Copy,
  Layers,
  CalendarDays,
  Server,
  UserCheck,
} from 'lucide-react';

const title = 'Challenge Rules';
const description =
  'The full Trivaro rulebook: profit target, daily and maximum drawdown, minimum trading days, news trading, Expert Advisors and bots, HFT, copy trading, hedging, weekend holding and prohibited practices.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/rules' },
  openGraph: {
    type: 'website',
    url: '/rules',
    siteName: 'Trivaro',
    title,
    description,
    images: ['/brand/trivaro-social-banner.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/brand/trivaro-social-banner.svg'],
  },
};

const objectives = [
  { label: 'Profit Target', value: '8% per phase' },
  { label: 'Maximum Daily Loss', value: '3%' },
  { label: 'Maximum Total Loss', value: '5%' },
  { label: 'Minimum Trading Days', value: '5' },
  { label: 'Time Limit', value: 'None' },
  { label: 'Consistency Rule', value: 'None' },
  { label: 'Profit Split', value: 'Up to 90%' },
  { label: 'Account Sizes', value: '$5K – $100K' },
];

interface Permission {
  icon: typeof Newspaper;
  title: string;
  verdict: 'allowed' | 'conditional' | 'not_allowed';
  detail: string;
}

const permissions: Permission[] = [
  {
    icon: Newspaper,
    title: 'News Trading',
    verdict: 'allowed',
    detail:
      'Permitted at every stage, including high-impact releases such as NFP, CPI and central-bank decisions. We do not impose a pre- or post-news trading window, and you may open, close or hold positions through an event.',
  },
  {
    icon: Bot,
    title: 'Expert Advisors & Bots',
    verdict: 'conditional',
    detail:
      'Allowed, provided the EA or algorithm is your own or commercially licensed to you, is customised (not a shared set of settings copied across many accounts) and does not exploit server latency, price-feed errors or simulated fill inaccuracies. You are fully responsible for how your software trades.',
  },
  {
    icon: Gauge,
    title: 'High-Frequency Trading (HFT)',
    verdict: 'not_allowed',
    detail:
      'Not permitted. This includes strategies whose trades are mostly held for seconds or less, latency or tick-data arbitrage, and any approach that generates an abnormal volume of orders or server requests. As a guide, no more than half of your trades should be held for under one minute.',
  },
  {
    icon: Copy,
    title: 'Copy Trading',
    verdict: 'conditional',
    detail:
      'Copying across your own personal accounts is allowed. Copying or mirroring another trader, a signal provider or a commercial trade-copying service is not, and a strategy may not be executed identically across different customers’ accounts.',
  },
  {
    icon: Layers,
    title: 'Hedging',
    verdict: 'conditional',
    detail:
      'Hedging within a single account is allowed. Opening opposing positions across several of your own accounts purely to exploit correlation or the drawdown rules is not permitted.',
  },
  {
    icon: CalendarDays,
    title: 'Weekend & Overnight Holding',
    verdict: 'allowed',
    detail:
      'Positions may be held overnight and over the weekend. There is no requirement to flatten before market close.',
  },
  {
    icon: Server,
    title: 'VPS & Remote Trading',
    verdict: 'allowed',
    detail:
      'You may trade from a VPS, remote server or VPN. Only one account per person is permitted, and you must not let anyone else trade on your behalf.',
  },
  {
    icon: UserCheck,
    title: 'Third-Party Management',
    verdict: 'not_allowed',
    detail:
      'Account-management services and “trade for me” arrangements are prohibited. The account must be traded by you, the registered account holder.',
  },
];

const prohibited = [
  'High-frequency trading, latency arbitrage and tick-scalping strategies.',
  'Exploiting pricing errors, gaps or inaccuracies in the simulated market data or order fills.',
  'Copying another trader or running the same EA settings across multiple customers’ accounts.',
  'Account-management services or allowing a third party to trade on your behalf.',
  'Coordinated or “switch” trading between accounts to defeat the drawdown limits.',
  'Deliberately abusing, overloading or attempting to manipulate the platform.',
  'Automated strategies that bracket a news release with simultaneous buy-stop and sell-stop orders.',
];

const faqs = [
  {
    q: 'Can I trade during economic news?',
    a: 'Yes. News trading is allowed at every stage and we do not restrict execution around high-impact releases. The only exception is bracketing a release with simultaneous buy-stop and sell-stop orders, which is treated as a prohibited practice.',
  },
  {
    q: 'Are Expert Advisors and bots allowed?',
    a: 'Yes, with conditions: the software must be yours or licensed to you, its settings must be customised, and it must not rely on latency, price-feed or simulated-fill exploits. It also must not breach the HFT rule.',
  },
  {
    q: 'Is there a time limit to complete the challenge?',
    a: 'No. Paid evaluations have no deadline, so you can trade at your own pace as long as you meet the minimum of 5 trading days and stay within the drawdown limits.',
  },
  {
    q: 'Is there a consistency rule?',
    a: 'No. We do not require any single day’s profit to stay below a percentage of your total profit. Meeting the 8% target over at least 5 trading days is enough to pass a phase.',
  },
  {
    q: 'What happens if I breach a rule?',
    a: 'The drawdown, profit-target and minimum-trading-day limits are monitored continuously by our risk engine and will automatically fail a challenge. Conduct rules are reviewed by our risk team, and a verified breach can void a challenge or a funded account.',
  },
];

const verdictStyles: Record<Permission['verdict'], { label: string; className: string }> = {
  allowed: { label: 'Allowed', className: 'text-green-400 border-green-400/30 bg-green-500/10' },
  conditional: {
    label: 'Allowed with conditions',
    className: 'text-amber-400 border-amber-400/30 bg-amber-500/10',
  },
  not_allowed: { label: 'Not permitted', className: 'text-red-400 border-red-400/30 bg-red-500/10' },
};

export default function RulesPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">
              Challenge <GradientText as="span">Rules</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Everything you can and cannot do inside a Trivaro challenge, in one place. The numeric
              limits are monitored continuously by our risk engine; the conduct rules below are
              reviewed by our risk team.
            </p>
          </div>
        </RevealOnScroll>

        {/* ---- Objectives ------------------------------------------------ */}
        <RevealOnScroll delay={0.05}>
          <div className="mt-16">
            <h2 className="mb-6 font-heading text-2xl font-bold">Evaluation Objectives</h2>
            <div className="overflow-hidden rounded-xl border border-teal-500/10">
              {objectives.map((rule, i) => (
                <div
                  key={rule.label}
                  className={cn(
                    'flex items-center justify-between px-6 py-4',
                    i % 2 === 0 ? 'bg-navy-700/60' : 'bg-navy-800',
                  )}
                >
                  <span className="text-sm text-text-secondary">{rule.label}</span>
                  <span className="text-sm font-semibold">{rule.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm text-text-muted">
              <p>
                <span className="text-text-secondary">Maximum Daily Loss (3%).</span> Measured from
                the highest equity reached during the trading day. Touching the limit fails the
                challenge.
              </p>
              <p>
                <span className="text-text-secondary">Maximum Total Loss (5%).</span> A trailing
                limit measured from the highest equity reached since the account opened — it never
                moves back down.
              </p>
              <p>
                <span className="text-text-secondary">Minimum Trading Days (5).</span> At least five
                separate calendar days with one or more closed trades before a phase can pass.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        {/* ---- Trading permissions --------------------------------------- */}
        <RevealOnScroll delay={0.1}>
          <div className="mt-20">
            <h2 className="mb-2 font-heading text-2xl font-bold">Trading &amp; Strategy Rules</h2>
            <p className="mb-6 text-sm text-text-secondary">
              Real trading conditions, with the same guardrails the major prop firms use for news,
              automation and high-frequency activity.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {permissions.map((p) => {
                const Icon = p.icon;
                const v = verdictStyles[p.verdict];
                return (
                  <div
                    key={p.title}
                    className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-5"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="font-heading text-base font-semibold">{p.title}</h3>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                        v.className,
                      )}
                    >
                      {v.label}
                    </span>
                    <p className="mt-3 text-sm text-text-secondary">{p.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </RevealOnScroll>

        {/* ---- Prohibited practices -------------------------------------- */}
        <RevealOnScroll delay={0.15}>
          <div className="mt-20 rounded-xl border border-red-500/20 bg-red-500/5 p-6 sm:p-8">
            <h2 className="mb-1 flex items-center gap-2 font-heading text-2xl font-bold">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Prohibited Practices
            </h2>
            <p className="mb-5 text-sm text-text-secondary">
              Using any of the following can void your challenge or funded account, even after a
              phase has been passed.
            </p>
            <ul className="space-y-3">
              {prohibited.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-text-secondary">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealOnScroll>

        {/* ---- Enforcement + payouts ------------------------------------- */}
        <RevealOnScroll delay={0.2}>
          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
              <h2 className="mb-3 font-heading text-lg font-semibold">How rules are enforced</h2>
              <p className="text-sm text-text-secondary">
                Drawdown, profit target and minimum trading days are checked automatically on every
                closed trade, and a breach fails the account in real time. Conduct rules are
                reviewed by the risk team; where a breach is confirmed, we may decline to pass a
                phase or to release a payout. You will always be told the rule that was applied.
              </p>
            </div>
            <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
              <h2 className="mb-3 font-heading text-lg font-semibold">Payouts &amp; profit split</h2>
              <p className="text-sm text-text-secondary">
                Funded traders keep up to 90% of their profits. Before the first payout we verify
                your identity, and payouts are made in the same cryptocurrency used to purchase the
                challenge. The profit split, not the fee, is what you take home.
              </p>
            </div>
          </div>
        </RevealOnScroll>

        {/* ---- FAQ -------------------------------------------------------- */}
        <RevealOnScroll delay={0.25}>
          <div className="mt-20">
            <h2 className="mb-6 font-heading text-2xl font-bold">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqs.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-teal-500/10 bg-navy-700/60 p-5"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" />
                      {f.q}
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.3}>
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <p className="max-w-xl text-sm text-text-secondary">
              Every rule here applies equally to challenge and funded accounts. The regulated
              refund terms are in the{' '}
              <Link href="/refund" className="text-teal-400 hover:underline">
                Refund Policy
              </Link>{' '}
              and the{' '}
              <Link href="/terms" className="text-teal-400 hover:underline">
                Terms of Service
              </Link>
              .
            </p>
            <Link href="/challenges" className={cn(buttonVariants({ variant: 'glow', size: 'xl' }))}>
              Start Your Challenge
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
