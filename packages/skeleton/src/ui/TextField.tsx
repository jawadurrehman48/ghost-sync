import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

const CONTROL =
  'block w-full rounded-xl border bg-white px-3 py-2 text-gray-900 placeholder-gray-500 transition-colors ' +
  'focus:outline-none focus:ring-2';
const OK = 'border-gray-300 focus:border-brand-600 focus:ring-brand-200';
const BAD = 'border-red-500 focus:border-red-600 focus:ring-red-200';

export interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Keep the label for screen readers but do not show it. */
  hideLabel?: boolean;
  children: ReactNode;
}

/** Label + control + hint/error, wired together for screen readers. */
export function FieldShell({ id, label, error, hint, hideLabel = false, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1 block text-sm font-medium text-gray-700'}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-gray-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  const ids = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  hint?: string;
  hideLabel?: boolean;
  /** "lg" is the big 56px amount field. */
  size?: 'md' | 'lg';
}

/** Single-line input with a visible label, error message and 48px touch target. */
export function TextField({ label, error, hint, hideLabel, size = 'md', id, className = '', ...rest }: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} hideLabel={hideLabel}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={`${CONTROL} ${error ? BAD : OK} ${
          size === 'lg' ? 'min-h-[56px] text-2xl font-semibold' : 'min-h-[48px] text-base'
        } ${className}`}
        {...rest}
      />
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  hideLabel?: boolean;
}

/** Multi-line input (notes, reasons). */
export function TextAreaField({ label, error, hint, hideLabel, id, rows = 3, className = '', ...rest }: TextAreaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} hideLabel={hideLabel}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={`${CONTROL} ${error ? BAD : OK} min-h-[48px] text-base ${className}`}
        {...rest}
      />
    </FieldShell>
  );
}
