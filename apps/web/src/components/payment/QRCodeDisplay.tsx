'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  return (
    <div className="inline-flex max-w-full rounded-xl bg-white p-3">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        fgColor="#0A1628"
        style={{ width: '100%', height: 'auto', maxWidth: size }}
      />
    </div>
  );
}
