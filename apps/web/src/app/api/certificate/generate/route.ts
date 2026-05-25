import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { createServerClient } from '@/lib/supabase-server';
import { CertificatePDF } from '@/components/certificates/CertificatePDF';

export const runtime = 'nodejs';

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

    const { data: challenge } = await supabase
      .from('challenges')
      .select('*, orders!inner(account_size)')
      .eq('id', challengeId)
      .single() as unknown as { data: { id: string; user_id: string; account_size: number; status: string } | null };

    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single() as unknown as { data: { full_name: string } | null };

    const traderName = (profile as { full_name: string } | null)?.full_name || user.email?.split('@')[0] || 'Trader';
    const accountSize = (challenge as { account_size: number }).account_size;
    const certNumber = `TRV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;

    const stream = await renderToStream(
      CertificatePDF({
        traderName,
        accountSize,
        certificateNumber: certNumber,
        completionDate: new Date().toISOString(),
      }),
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="trivaro-certificate-${certNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Certificate generation error:', message);
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 });
  }
}
