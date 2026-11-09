import { formatPaisa } from '@skeleton/core';

/**
 * owed     red    (money customers owe / credit given)
 * received green  (payments received)
 * balance  red if the customer owes (> 0), green if settled or in advance
 * muted    gray   (reversed entries)
 */
export type MoneyTone = 'owed' | 'received' | 'balance' | 'muted';

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

export interface MoneyProps {
  paisa: number;
  tone?: MoneyTone;
  className?: string;
  strikethrough?: boolean;
}

/**
 * An amount as "Rs 1,200". dir="ltr" keeps "Rs", digits, commas and a minus
 * sign in the right order even inside right-to-left (Urdu) text.
 */
export function Money({ paisa, tone = 'balance', className = '', strikethrough = false }: MoneyProps) {
  return (
    <span
      dir="ltr"
      className={`inline-block font-semibold tabular-nums ${colorFor(tone, paisa)} ${
        strikethrough ? 'line-through' : ''
      } ${className}`}
    >
      {formatPaisa(paisa)}
    </span>
  );
}

/** Translation key for the word shown next to a balance (so colour is never the only signal). */
export function balanceStatusKey(paisa: number): string {
  if (paisa > 0) return 'khata.customers.owes';
  if (paisa < 0) return 'khata.customers.advance';
  return 'khata.customers.settled';
}
