import { formatPaisa } from '@skeleton/core';

/**
 * owed     red    (money customers owe / credit given)
 * received green  (payments received)
 * balance  red if the customer owes (> 0), green if settled or in advance
 * muted    gray   (reversed entries)
 */
export type MoneyTone = 'owed' | 'received' | 'balance' | 'muted';
export type MoneySize = 'sm' | 'md' | 'lg' | 'xl' | 'hero';

const RED = 'text-red-600';
const GREEN = 'text-green-700';

function colorFor(tone: MoneyTone, paisa: number): string {
  switch (tone) {
    case 'owed':
      return RED;
    case 'received':
      return GREEN;
    case 'muted':
      return 'text-gray-500';
    case 'balance':
      return paisa > 0 ? RED : GREEN;
  }
}

/**
 * Text size by size name AND by how long the amount is, so a huge amount such
 * as "Rs 4,999,999,500" shrinks to fit a 360px screen instead of overflowing.
 */
function sizeFor(size: MoneySize, length: number): string {
  switch (size) {
    case 'sm':
      return 'text-sm';
    case 'md':
      return length > 16 ? 'text-sm' : 'text-base';
    case 'lg':
      return length > 14 ? 'text-base' : 'text-lg';
    case 'xl':
      return length > 14 ? 'text-lg' : 'text-xl';
    case 'hero':
      if (length <= 11) return 'text-4xl';
      if (length <= 14) return 'text-3xl';
      if (length <= 18) return 'text-2xl';
      return 'text-xl';
  }
}

export interface MoneyProps {
  paisa: number;
  tone?: MoneyTone;
  size?: MoneySize;
  className?: string;
  strikethrough?: boolean;
}

/**
 * An amount as "Rs 1,200". dir="ltr" keeps "Rs", digits, commas and a minus
 * sign in the right order even inside right-to-left (Urdu) text, and the
 * plain sans-serif font keeps digits crisp and evenly spaced.
 */
export function Money({ paisa, tone = 'balance', size = 'md', className = '', strikethrough = false }: MoneyProps) {
  const text = formatPaisa(paisa);
  return (
    <span
      dir="ltr"
      className={`inline-block shrink-0 whitespace-nowrap font-sans font-semibold tabular-nums ${colorFor(
        tone,
        paisa,
      )} ${sizeFor(size, text.length)} ${strikethrough ? 'line-through' : ''} ${className}`}
    >
      {text}
    </span>
  );
}

/** Translation key for the word shown next to a balance (so colour is never the only signal). */
export function balanceStatusKey(paisa: number): string {
  if (paisa > 0) return 'khata.customers.owes';
  if (paisa < 0) return 'khata.customers.advance';
  return 'khata.customers.settled';
}
