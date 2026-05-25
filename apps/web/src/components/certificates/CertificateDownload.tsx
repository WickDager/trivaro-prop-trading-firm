'use client';

import { useState } from 'react';
import { FileText, Loader2, Download, Award } from 'lucide-react';

interface CertificateDownloadProps {
  challengeId: string;
  isComplete: boolean;
}

export function CertificateDownload({ challengeId, isComplete }: CertificateDownloadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isComplete) return null;

  async function handleDownload() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/certificate/generate?challengeId=${challengeId}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate certificate');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trivaro-certificate-${challengeId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-teal-500/10 bg-gradient-to-br from-green-500/5 to-teal-500/5 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
            <Award className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">Challenge Complete</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Congratulations! Download your funded trader certificate.
            </p>
            {error && (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {loading ? 'Generating...' : 'Download PDF'}
        </button>
      </div>
    </div>
  );
}
