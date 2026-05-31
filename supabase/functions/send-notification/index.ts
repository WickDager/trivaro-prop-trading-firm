import { serve } from 'std/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const EDGE_FUNCTION_API_KEY = Deno.env.get('EDGE_FUNCTION_API_KEY')!;
const RESEND_URL = 'https://api.resend.com/emails';
const FROM_EMAIL = 'Trivaro <notifications@trivaro.com>';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    challenge_id: string;
    user_id: string;
    type: 'challenge_failed' | 'phase_complete' | 'daily_drawdown_warning';
    status: string;
    recipient_email: string;
    subject: string;
    rule_violated: string | null;
    equity_at_time: number | null;
    metadata: {
      profit_pct: number;
      daily_drawdown_pct: number;
      max_drawdown_pct: number;
      trading_days: number;
      starting_balance: number;
      account_size: number;
    };
  };
}

function buildHtml(record: WebhookPayload['record']): string {
  const m = record.metadata;
  const equityFormatted = record.equity_at_time ? `$${record.equity_at_time.toLocaleString()}` : 'N/A';

  switch (record.type) {
    case 'challenge_failed': {
      const ruleName = record.rule_violated === 'daily_drawdown'
        ? 'Daily Drawdown'
        : record.rule_violated === 'max_drawdown'
          ? 'Maximum Drawdown'
          : record.rule_violated ?? 'Unknown';

      const detail = record.rule_violated === 'daily_drawdown'
        ? `Your equity dropped ${m.daily_drawdown_pct.toFixed(2)}% from the daily peak (limit: 3%).`
        : `Your equity dropped ${m.max_drawdown_pct.toFixed(2)}% from the all-time high (limit: 5%).`;

      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#070b1a;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#070b1a;padding:40px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#0f1425;border-radius:12px;border:1px solid rgba(239,68,68,0.2)">
<tr><td style="padding:40px 40px 24px;text-align:center">
  <h1 style="color:#ef4444;font-size:22px;margin:0">Challenge Failed</h1>
</td></tr>
<tr><td style="padding:0 40px 32px;color:#94a3b8;font-size:15px;line-height:1.6">
  <p>Your ${m.account_size ? '$' + m.account_size.toLocaleString() : ''} challenge has been marked as <strong style="color:#ef4444">failed</strong>.</p>
  <hr style="border-color:rgba(239,68,68,0.15);margin:20px 0">
  <p><strong style="color:#fff">Rule Violated:</strong> ${ruleName}</p>
  <p>${detail}</p>
  <p><strong style="color:#fff">Equity at violation:</strong> ${equityFormatted}</p>
  <p><strong style="color:#fff">Trading days:</strong> ${m.trading_days}</p>
  <hr style="border-color:rgba(239,68,68,0.15);margin:20px 0">
  <p>You can purchase a new challenge from your <a href="https://trivaro-prop-trading-firm.vercel.app/challenges" style="color:#2dd4bf">dashboard</a>.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
    }

    case 'phase_complete': {
      const isFunded = m.profit_pct >= 8;
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#070b1a;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#070b1a;padding:40px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#0f1425;border-radius:12px;border:1px solid rgba(45,212,191,0.2)">
<tr><td style="padding:40px 40px 24px;text-align:center">
  <h1 style="color:#2dd4bf;font-size:22px;margin:0">${isFunded ? 'Funded!' : 'Phase Complete!'}</h1>
</td></tr>
<tr><td style="padding:0 40px 32px;color:#94a3b8;font-size:15px;line-height:1.6">
  <p>You reached the 8% profit target with a gain of <strong style="color:#4ade80">${m.profit_pct.toFixed(2)}%</strong>. Your equity is now ${equityFormatted}.</p>
  <hr style="border-color:rgba(45,212,191,0.15);margin:20px 0">
  <p><strong style="color:#fff">Next step:</strong> ${isFunded ? 'You are now funded! Start trading on your live account.' : 'You are now in the next phase. Continue trading to reach the next target.'}</p>
  <hr style="border-color:rgba(45,212,191,0.15);margin:20px 0">
  <p>View your <a href="https://trivaro-prop-trading-firm.vercel.app/dashboard" style="color:#2dd4bf">dashboard</a> for details.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;
    }

    case 'daily_drawdown_warning':
      return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#070b1a;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#070b1a;padding:40px 0">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#0f1425;border-radius:12px;border:1px solid rgba(251,191,36,0.2)">
<tr><td style="padding:40px 40px 24px;text-align:center">
  <h1 style="color:#fbbf24;font-size:22px;margin:0">Drawdown Warning</h1>
</td></tr>
<tr><td style="padding:0 40px 32px;color:#94a3b8;font-size:15px;line-height:1.6">
  <p>Your daily drawdown is approaching the limit.</p>
  <p><strong style="color:#fbbf24">Current daily drawdown:</strong> ${m.daily_drawdown_pct.toFixed(2)}% (limit: 3%)</p>
  <p><strong style="color:#fff">Current equity:</strong> ${equityFormatted}</p>
  <p>Please trade cautiously to avoid failing your challenge.</p>
</td></tr>
</table>
</td></tr></table></body></html>`;

    default:
      return '';
  }
}

serve(async (req) => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${EDGE_FUNCTION_API_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const record = payload.record;
  if (!record || !record.recipient_email) {
    return new Response(JSON.stringify({ error: 'missing record or recipient' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: record.recipient_email,
        subject: record.subject,
        html: buildHtml(record),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ ok: false, error: 'resend_api_error', details: err }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ ok: true, resend_id: data.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Send error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'send_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
