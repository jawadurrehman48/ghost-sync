/** "none" = the caller sets the size (e.g. screen-relative sizes on the display). */
export type TokenLabelSize = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

const SIZE: Record<TokenLabelSize, string> = {
  none: '',
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
  hero: 'text-7xl',
};

/**
 * A token label such as "A-12": bold, digits evenly spaced, and always
 * left-to-right so "A-12" never turns into "12-A" inside Urdu text.
 */
export function TokenLabel({
  label,
  size = 'md',
  className = '',
}: {
  label: string;
  size?: TokenLabelSize;
  className?: string;
}) {
  return (
    <span dir="ltr" className={`inline-block whitespace-nowrap font-sans font-extrabold tabular-nums ${SIZE[size]} ${className}`}>
      {label}
    </span>
  );
}
