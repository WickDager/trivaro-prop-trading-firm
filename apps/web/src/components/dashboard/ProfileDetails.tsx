'use client';

import { useEffect, useState } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Loader2, UserRound } from 'lucide-react';

/**
 * The non-document half of onboarding.
 *
 * Every funded-account provider ends up asking for these before the first
 * payout (legal name is captured at signup); asking up front means the KYC
 * step only has to add documents. Deliberately no ID upload, no tax id and no
 * bank details: those belong in the KYC/vendor flow, not a dashboard form.
 */

interface Fields {
  country_code: string;
  phone_e164: string;
  date_of_birth: string;
  address_line1: string;
  city: string;
  postal_code: string;
}

const EMPTY: Fields = {
  country_code: '',
  phone_e164: '',
  date_of_birth: '',
  address_line1: '',
  city: '',
  postal_code: '',
};

const INPUT_CLASS =
  'w-full rounded-lg border border-teal-500/10 bg-navy-800 py-2.5 px-3 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none';

const LABEL_CLASS = 'mb-1 block text-xs font-medium text-text-secondary';

export function ProfileDetails() {
  const { supabase } = useSupabase();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('country_code, phone_e164, date_of_birth, address_line1, city, postal_code')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (data) {
        setFields({
          country_code: data.country_code ?? '',
          phone_e164: data.phone_e164 ?? '',
          date_of_birth: data.date_of_birth ?? '',
          address_line1: data.address_line1 ?? '',
          city: data.city ?? '',
          postal_code: data.postal_code ?? '',
        });
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Origin': window.location.origin },
        body: JSON.stringify({
          country_code: fields.country_code || null,
          phone_e164: fields.phone_e164 || null,
          date_of_birth: fields.date_of_birth || null,
          address_line1: fields.address_line1 || null,
          city: fields.city || null,
          postal_code: fields.postal_code || null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        fields?: Record<string, string>;
        error?: string;
      };

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        toast.error(
          data.error === 'validation_failed'
            ? 'Check the highlighted fields.'
            : 'Could not save your details. Please try again.',
        );
        return;
      }

      toast.success('Details saved');
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Account details</CardTitle>
        <UserRound className="h-4 w-4 text-teal-400" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <form onSubmit={save} className="space-y-4" noValidate>
            <p className="text-xs text-text-muted">
              Needed before your first payout. Identity documents are requested separately.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="country_code" className={LABEL_CLASS}>
                  Country
                </label>
                <input
                  id="country_code"
                  name="country_code"
                  autoComplete="country"
                  maxLength={2}
                  value={fields.country_code}
                  onChange={(e) => set('country_code', e.target.value.toUpperCase())}
                  placeholder="GB"
                  aria-invalid={Boolean(errors.country_code)}
                  aria-describedby={errors.country_code ? 'country_code_error' : undefined}
                  className={INPUT_CLASS}
                />
                {errors.country_code && (
                  <p id="country_code_error" className="mt-1 text-xs text-red-400">
                    {errors.country_code}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="phone_e164" className={LABEL_CLASS}>
                  Phone
                </label>
                <input
                  id="phone_e164"
                  name="phone_e164"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={fields.phone_e164}
                  onChange={(e) => set('phone_e164', e.target.value)}
                  placeholder="+447700900123"
                  aria-invalid={Boolean(errors.phone_e164)}
                  aria-describedby={errors.phone_e164 ? 'phone_e164_error' : undefined}
                  className={INPUT_CLASS}
                />
                {errors.phone_e164 && (
                  <p id="phone_e164_error" className="mt-1 text-xs text-red-400">
                    {errors.phone_e164}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="date_of_birth" className={LABEL_CLASS}>
                  Date of birth
                </label>
                <input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  autoComplete="bday"
                  value={fields.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                  aria-invalid={Boolean(errors.date_of_birth)}
                  aria-describedby={errors.date_of_birth ? 'date_of_birth_error' : undefined}
                  className={INPUT_CLASS}
                />
                {errors.date_of_birth && (
                  <p id="date_of_birth_error" className="mt-1 text-xs text-red-400">
                    {errors.date_of_birth}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="postal_code" className={LABEL_CLASS}>
                  Postal code
                </label>
                <input
                  id="postal_code"
                  name="postal_code"
                  autoComplete="postal-code"
                  value={fields.postal_code}
                  onChange={(e) => set('postal_code', e.target.value.toUpperCase())}
                  aria-invalid={Boolean(errors.postal_code)}
                  aria-describedby={errors.postal_code ? 'postal_code_error' : undefined}
                  className={INPUT_CLASS}
                />
                {errors.postal_code && (
                  <p id="postal_code_error" className="mt-1 text-xs text-red-400">
                    {errors.postal_code}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="address_line1" className={LABEL_CLASS}>
                Address
              </label>
              <input
                id="address_line1"
                name="address_line1"
                autoComplete="address-line1"
                value={fields.address_line1}
                onChange={(e) => set('address_line1', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="city" className={LABEL_CLASS}>
                City
              </label>
              <input
                id="city"
                name="city"
                autoComplete="address-level2"
                value={fields.city}
                onChange={(e) => set('city', e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <Button type="submit" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save details
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
