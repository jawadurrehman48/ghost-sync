/**
 * Shared Tailwind class strings so every screen looks the same.
 * Logical utilities only (ps/pe/ms/me/text-start/text-end), no left/right.
 * Every interactive element is at least 44px tall; primary buttons are 48px.
 */

export const card = 'rounded-xl border border-gray-100 bg-white p-4 shadow-sm';

const button =
  'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export const primaryButton = `${button} bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800`;
export const secondaryButton = `${button} bg-indigo-50 text-indigo-800 hover:bg-indigo-100 active:bg-indigo-200`;
export const creditButton = `${button} bg-red-600 text-white hover:bg-red-700 active:bg-red-800`;
export const paymentButton = `${button} bg-green-700 text-white hover:bg-green-800 active:bg-green-900`;
export const neutralButton = `${button} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100`;

/** Small in-card action (still 44px tall). */
export const smallButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 active:bg-gray-100';

export const input =
  'block min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';

/** The big amount field on the add-entry screen (56px tall). */
export const amountInput = `${input} min-h-[56px] text-2xl font-semibold`;

export const label = 'mb-1 block text-sm font-medium text-gray-700';
export const fieldError = 'mt-1 text-sm font-medium text-red-700';
export const sectionTitle = 'mb-2 text-base font-semibold text-gray-800';
export const mutedText = 'text-sm text-gray-600';
