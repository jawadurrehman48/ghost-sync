export interface SpinnerProps {
  /** Size and colour classes. The spinner uses the current text colour. */
  className?: string;
}

/** A small decorative spinner. Pair it with text (or role="status") so it is announced. */
export function Spinner({ className = 'h-5 w-5' }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
