import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { createServerClient } from '@/lib/supabase-server';
import { createServiceClient } from '@/lib/supabase';
import { CertificatePDF } from '@/components/certificates/CertificatePDF';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Statuses that legitimately earn a certificate. */
const CERTIFIABLE = new Set(['passed', 'phase2_complete', 'funded']);

type CertificateRow = {
  certificate_number: string;
  trader_name: string;
  account_size: number;
  completion_date: string;
};

function mintCertificateNumber(): string {
  const year = new Date().getFullYear();
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
  return `TRV-${year}-${String(random).padStart(5, '0')}`;
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challengeId');

    if (!challengeId) {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
    }

    // PostgREST returns embedded relations NESTED. The previous code read
    // `challenge.account_size`, which never existed, so the PDF rendered
    // "$NaN,000 Account". `starting_balance` is the authoritative figure.
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id,user_id,status,account_number,starting_balance,created_at')
      .eq('id', challengeId)
      .maybeSingle();

    if (challengeError) {
      console.error('Certificate lookup failed:', challengeError.message);
      return NextResponse.json({ error: 'Failed to load challenge' }, { status: 500 });
    }

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // A certificate asserts that the trader passed. Without this check any
    // signed-in user could mint a "funded trader" certificate for a challenge
    // they had not completed.
    if (!CERTIFIABLE.has(String(challenge.status))) {
      return NextResponse.json(
        { error: 'Certificate is only available for completed challenges' },
        { status: 409 },
      );
    }

    const accountSize = Number(challenge.starting_balance) || 0;

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    const p = profile as { first_name?: string | null; last_name?: string | null } | null;
    const traderName = p?.first_name
      ? [p.first_name, p.last_name].filter(Boolean).join(' ')
      : user.email?.split('@')[0] || 'Trader';

    // Certificates are persisted so the number is stable across downloads and
    // can actually be looked up by a verification page. RLS restricts insert to
    // the service role, so use an admin client for this one write.
    const admin = createServiceClient();
    let certificate: CertificateRow | null = null;

    const { data: existing } = await admin
      .from('certificates')
      .select('certificate_number,trader_name,account_size,completion_date')
      .eq('challenge_id', challengeId)
      .maybeSingle();

    if (existing) {
      certificate = existing as CertificateRow;
    } else {
      const payload = {
        user_id: user.id,
        challenge_id: challengeId,
        certificate_number: mintCertificateNumber(),
        trader_name: traderName,
        account_size: accountSize,
        completion_date: new Date().toISOString(),
      };

      // Retry once in the (unlikely) event of a certificate-number collision.
      for (let attempt = 0; attempt < 2 && !certificate; attempt++) {
        const { data: created, error: insertError } = await admin
          .from('certificates')
          .insert(payload)
          .select('certificate_number,trader_name,account_size,completion_date')
          .single();

        if (created) {
          certificate = created as CertificateRow;
        } else {
          console.error('Certificate insert failed:', insertError?.message);
          if (insertError?.code !== '23505') break;
          payload.certificate_number = mintCertificateNumber();
        }
      }
    }

    // Fall back to an unpersisted number rather than failing the download.
    const certNumber = certificate?.certificate_number ?? mintCertificateNumber();

    const stream = await renderToStream(
      CertificatePDF({
        traderName: certificate?.trader_name ?? traderName,
        accountSize: certificate?.account_size ?? accountSize,
        certificateNumber: certNumber,
        completionDate: certificate?.completion_date ?? new Date().toISOString(),
      }),
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="trivaro-certificate-${certNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        // Per-user document — never let a shared cache hold it.
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Certificate generation error:', message);
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 });
  }
}
