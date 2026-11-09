import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Spinner } from './Spinner';

/**
 * primary        brand colour: the main action on a screen
 * secondary      soft brand tint: a helpful but optional action
 * neutral        white with a border: cancel / back / low emphasis
 * danger         solid red (also used by apps for "money owed" actions)
 * dangerOutline  red outline: destructive actions that need a second step
 * success        solid green (also used by apps for "money received" actions)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'neutral' | 'danger' | 'dangerOutline' | 'success';
export type ButtonSize = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold shadow-sm transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200',
  neutral: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  dangerOutline: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 active:bg-red-100',
  success: 'bg-green-700 text-white hover:bg-green-800 active:bg-green-900',
};

/** Touch targets: md is 48px tall, sm is 44px tall (the minimum). */
const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'min-h-[48px] px-4 py-3 text-base',
  sm: 'min-h-[44px] px-4 py-2 text-sm',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Defaults to true for size "md", false for "sm". */
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  icon?: ReactNode;
  /** If set, renders a link (<a>) that looks like a button. */
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** The one button style for every screen. */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading = false,
  icon,
  href,
  target,
  rel,
  className = '',
  type = 'button',
  disabled,
  ref,
  ...rest
}: ButtonProps) {
  const width = (fullWidth ?? size === 'md') ? 'w-full' : '';
  const classes = [BASE, SIZE_CLASS[size], VARIANT_CLASS[variant], width, className].filter(Boolean).join(' ');
  const content = (
    <>
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      <span>{children}</span>
    </>
  );

  if (href !== undefined) {
    return (
      <a
        href={href}
        target={target}
        rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
        aria-disabled={disabled || undefined}
        className={classes}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
}
