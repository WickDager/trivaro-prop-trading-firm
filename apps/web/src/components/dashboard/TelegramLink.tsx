'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { CheckCircle2, ExternalLink, Loader2, Send, Unlink } from 'lucide-react';

/**
 * Telegram account linking.
 *
 * The dashboard never asks the customer to type "@handle": a typed handle is
 * unverifiable and Telegram lets people change it. Instead this mints a
 * one-time deep link, and the bot binds the numeric Telegram user id of
 * whoever presses Start. See /api/telegram/link and the telegram-webhook
 * function.
 */

interface LinkState {
  linked: boolean;
  username: string | null;
}

const POLL_INTERVAL_MS = 3000;
/** Give up quietly after 3 minutes; the token itself dies after 10. */
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export function TelegramLink() {
  const [state, setState] = useState<LinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const startedAt = useRef<number>(0);

  const refresh = useCallback(async (): Promise<LinkState | null> => {
    try {
      const res = await fetch('/api/telegram/link', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = (await res.json()) as Partial<LinkState>;
      const next = { linked: Boolean(data.linked), username: data.username ?? null };
      setState(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  // Initial read. Defined inside the effect (and called, not awaited) so the
  // only setState happens in the promise callback after mount — the same shape
  // the dashboard page uses, and the one the react-hooks lint rule accepts.
  useEffect(() => {
    async function load() {
      const res = await fetch('/api/telegram/link', { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) {
        setState({ linked: false, username: null });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as Partial<LinkState>;
      setState({ linked: Boolean(data.linked), username: data.username ?? null });
    }

    load();
  }, []);

  // Poll while a link is pending so the card flips to "Connected" the moment
  // the customer presses Start, without them having to reload the page.
  useEffect(() => {
    if (!waiting) return;

    startedAt.current = Date.now();
    const id = setInterval(async () => {
      const next = await refresh();
      if (next?.linked) {
        setWaiting(false);
        setManualUrl(null);
        toast.success('Telegram connected');
      } else if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setWaiting(false);
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [waiting, refresh]);

  async function connect() {
    setBusy(true);
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Origin': window.location.origin },
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        toast.error(
          data.error === 'telegram_not_configured'
            ? 'Telegram is not configured yet. Please contact support.'
            : 'Could not create a link. Please try again.',
        );
        return;
      }

      // A popup blocker makes window.open return null — keep the URL visible so
      // the customer can still finish the flow in a second tab.
      const opened = window.open(data.url, '_blank', 'noopener,noreferrer');
      setManualUrl(data.url);
      setWaiting(true);
      if (!opened) toast.message('Allow pop-ups, or open the Telegram link below.');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'DELETE',
        headers: { 'Origin': window.location.origin },
      });
      if (!res.ok) {
        toast.error('Could not disconnect Telegram. Please try again.');
        return;
      }
      setState({ linked: false, username: null });
      setWaiting(false);
      setManualUrl(null);
      toast.success('Telegram disconnected');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Telegram</CardTitle>
        <Send className="h-4 w-4 text-teal-400" aria-hidden="true" />
      </CardHeader>
      <CardContent className="space-y-3">
        {state === null ? (
          <p className="text-sm text-text-muted">Checking your connection…</p>
        ) : state.linked ? (
          <>
            <p className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Connected{state.username ? ` as @${state.username}` : ''}
            </p>
            <p className="text-xs text-text-muted">
              Account and payment updates from the bot arrive in this chat.
            </p>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Unlink className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              Connect Telegram to get challenge and payment updates in chat.
            </p>
            <Button onClick={connect} disabled={busy || waiting} size="sm">
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {waiting ? 'Waiting for Telegram…' : 'Connect Telegram'}
            </Button>
            {waiting && (
              <p className="text-xs text-text-muted" role="status" aria-live="polite">
                Press <strong>Start</strong> in the Telegram chat, then come back here.
              </p>
            )}
            {manualUrl && (
              <a
                href={manualUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-xs text-teal-400 underline underline-offset-2 hover:text-teal-300"
              >
                Open Telegram <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
