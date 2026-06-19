# Trivaro — Prop Trading Firm

A modern prop trading platform. Traders buy challenges, prove their skills in a simulated MT5 environment, and get funded with real capital. Built with Next.js 16, Supabase, and a Python MT5 bridge.

## Architecture

```
User → Next.js Web App → Supabase (Auth + DB + Edge Functions)
                              ↑
MT5 Bridge (Python/VPS) ──────┘  (equity snapshots + trade forwarding)
                              ↓
Telegram Bot ← Payment Verification → Edge Functions → Resend (email)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, Framer Motion |
| Auth | Supabase Auth (cookie-based via `@supabase/ssr`) |
| Database | Supabase (PostgreSQL) |
| Edge Functions | Supabase (Deno / TypeScript) |
| Charts | Recharts |
| Payments | TRC20 USDT, USDC (Base), BTC — verified on-chain |
| MT5 Monitor | Python (Windows VPS) |
| Email | Resend |
| Bot | Telegram (Deno) |
| CI/CD | GitHub Actions + Vercel |
| Monorepo | Turborepo + npm workspaces |

## Project Structure

```
trivaro-prop-trading-firm/
├── apps/
│   ├── web/                        # Next.js frontend + API routes
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (marketing)/    # Public pages: /, /login, /challenges, /how-it-works, /pricing, etc.
│   │       │   ├── (dashboard)/    # Protected: /dashboard, /payments, /challenge/[id]
│   │       │   └── (admin)/admin/  # Admin: users, challenges, orders
│   │       ├── components/
│   │       │   ├── layout/         # Navbar, Footer, Sidebar, MobileNav
│   │       │   ├── ui/             # shadcn-style primitives (Button, Card, Sheet, Badge, etc.)
│   │       │   ├── sections/       # Homepage sections (Hero, Features, Pricing, Stats, CTA, etc.)
│   │       │   ├── dashboard/      # Dashboard widgets
│   │       │   ├── shared/         # Shared components (Logo, GlowButton, GradientText)
│   │       │   ├── animations/     # Aurora, Particles, Grid, RevealOnScroll
│   │       │   └── payment/        # CryptoSelector, WalletAddress, TelegramRedirect
│   │       ├── lib/                # Supabase clients, constants, blockchain utils
│   │       ├── hooks/              # useSupabase, useMediaQuery, useClipboard, etc.
│   │       └── types/              # Database types
│   │
│   └── telegram-bot/               # Deno Telegram bot (payment intake + verification)
│       └── src/
│           ├── handlers/           # payment.ts, verify.ts, support.ts
│           ├── services/           # blockchain.ts, supabase.ts, telegram.ts
│           └── templates/          # successMessage.ts
│
├── packages/
│   ├── shared-types/               # TypeScript types shared across monorepo
│   └── ui-config/                  # Design tokens (colors, breakpoints, glass styles)
│
├── bridge/                         # Python MT5 centralized monitor
│   ├── mt5_bridge.py               # Main monitor script
│   ├── config.json                 # Secrets + account list
│   ├── requirements.txt            # MetaTrader5, requests
│   ├── run_bridge.bat              # Windows launcher
│   └── setup_task.ps1              # Windows Scheduled Task installer
│
├── supabase/
│   └── functions/
│       ├── receive-trade/          # Receives trade data from MT5 bridge
│       ├── send-notification/      # Sends email via Resend
│       ├── verify-payment/         # Blockchain payment verification
│       ├── create-challenge/       # Auto-creates challenge on payment
│       ├── send-credentials/       # Sends MT5 credentials to user
│       └── telegram-webhook/       # Telegram bot webhook handler
│
└── .github/workflows/
    ├── deploy-web.yml              # CI for web app (build + Vercel deploy)
    ├── deploy-bot.yml              # Deploy edge functions
    └── keep-alive.yml              # Ping Supabase every 3 days to prevent pause
```

## Quick Start

### Prerequisites

- Node.js >= 22
- npm >= 9
- Supabase account + project
- Git (optional)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/trivaro-prop-trading-firm.git
cd trivaro-prop-trading-firm
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in all required values (see .env.example for template)

# 3. Start dev server
npm run dev -w @trivaro/web
# Opens at http://localhost:3000
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Telegram
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_BOT_USERNAME=<bot-username>
TELEGRAM_WEBHOOK_SECRET=<webhook-secret>

# Blockchain
TRONGRID_API_KEY=<trongrid-key>

# Resend (Email)
RESEND_API_KEY=<resend-key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=<bot-username>

# Wallet (receiving payments)
HOT_WALLET_USDT_TRC20=<wallet-address>
HOT_WALLET_BTC=<wallet-address>

# MT5 Integration
MT5_API_SECRET=<mt5-api-secret>
EDGE_FUNCTION_API_KEY=<edge-function-key>
```

### Database

The database schema includes these tables:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to Supabase Auth) |
| `challenges` | Trading challenge accounts |
| `trades` | Individual trades per challenge |
| `orders` | Payment orders |
| `equity_snapshots` | Daily equity/balance snapshots |
| `notification_log` | Email notification history |
| `certificates` | Funded trader certificates |
| `admin_audit_log` | Admin action audit trail |

Migrations should be run via the Supabase Dashboard SQL Editor.

### Scripts

```bash
# Development
npm run dev -w @trivaro/web       # Start Next.js dev server (Turbopack)

# Build
npm run build                      # Turborepo build (all packages)
npm run build -w @trivaro/web     # Build web app only

# Type checking
npm run typecheck -w @trivaro/web # TypeScript check
npm run lint -w @trivaro/web      # ESLint

# Clean
npm run clean -w @trivaro/web     # Remove .next and .turbo
```

## Supabase Edge Functions

Six edge functions are deployed on Supabase:

| Function | Trigger | Purpose |
|----------|---------|---------|
| `telegram-webhook` | Telegram webhook | Handles bot messages (`/pay`, `/verify`, `/status`) |
| `verify-payment` | HTTP POST | Verifies blockchain transactions (USDT, USDC, BTC) |
| `create-challenge` | Database webhook | Creates challenge account on verified payment |
| `send-credentials` | Database webhook | Emails MT5 credentials after challenge creation |
| `receive-trade` | HTTP POST (MT5 bridge) | Receives and deduplicates trades from MT5 monitor |
| `send-notification` | Database webhook | Sends email alerts (drawdown, phase complete, failed) |

### Deploy Edge Functions

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase functions deploy receive-trade
npx supabase functions deploy send-notification
# ... deploy remaining functions
```

## MT5 Bridge

The Python bridge runs on a Windows VPS. It connects to client MT5 accounts via investor (read-only) passwords and forwards trading data to Supabase.

### Setup

```bash
cd bridge/
pip install -r requirements.txt
# Edit config.json with your Supabase credentials and MT5 account list
python mt5_bridge.py --once    # Test single poll cycle
python mt5_bridge.py            # Continuous mode
```

### Windows Scheduled Task

Run `setup_task.ps1` as Administrator to install a Windows Scheduled Task that auto-starts the bridge on boot.

## Deployment

### Web App (Vercel)

The web app is deployed to Vercel. Pushes to `main` trigger the GitHub Actions CI pipeline. Vercel auto-deploys from the connected repository.

```bash
# Manual deploy
npx vercel --prod
```

### Edge Functions (Supabase)

GitHub Actions deploys edge functions on push to `main` when `supabase/functions/**` changes.

## Routes

### Public (Marketing)
| Route | Page |
|-------|------|
| `/` | Homepage |
| `/how-it-works` | Challenge process |
| `/challenges` | Challenge selection + payment |
| `/pricing` | Pricing comparison table |
| `/login` | Sign in / sign up |
| `/about` | Company info |
| `/contact` | Support contact |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/refund` | Refund Policy |

### Dashboard (Authenticated)
| Route | Page |
|-------|------|
| `/dashboard` | Trading performance overview |
| `/challenge/[id]` | Individual challenge detail |
| `/payments` | Payment history |

### Admin (Role-gated)
| Route | Page |
|-------|------|
| `/admin` | Admin overview |
| `/admin/users` | User management |
| `/admin/challenges` | Challenge management |
| `/admin/orders` | Order management |

## Design System

Custom dark theme with navy/teal/green palette:

- **Background**: `#0A1628` (navy-800)
- **Primary**: `#00D9FF` (teal)
- **Accent**: `#00FF88` (green)
- **Fonts**: Space Grotesk (headings), Inter (body), JetBrains Mono (mono)
- **UI**: Custom shadcn-style primitives with glass morphism effects
- **Animations**: Framer Motion (spring transitions, scroll reveals, 3D card effects)
- **Breakpoints**: Mobile-first, responsive across all device sizes

## License

Private — all rights reserved.
