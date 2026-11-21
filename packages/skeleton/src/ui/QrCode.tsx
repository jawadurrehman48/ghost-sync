import { useMemo } from 'react';
import { encode } from 'uqr';

export interface QrCodeProps {
  /** The text or link to encode. */
  value: string;
  /** Accessible description of what scanning it does. */
  label: string;
  className?: string;
}

/**
 * A QR code drawn as one SVG path (black on white, with the standard quiet
 * zone). Encoding uses the tiny `uqr` library; drawing is done here, so no
 * HTML string is ever injected into the page.
 */
export function QrCode({ value, label, className = 'h-48 w-48' }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 4 });
    let d = '';
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { size: qr.size, path: d };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
