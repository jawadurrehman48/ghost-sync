import type { ReactNode } from 'react';

export interface BottomNavItem<K extends string = string> {
  key: K;
  label: string;
  icon?: ReactNode;
}

export interface BottomNavProps<K extends string = string> {
  items: BottomNavItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Accessible name for the navigation landmark (pass a translated string). */
  ariaLabel?: string;
}

/**
 * Bottom tab bar, pinned to the bottom of the phone-width column.
 * Each tab is at least 56px tall. Tab order flips automatically in RTL because
 * it is a flex row. Pages using it should leave ~96px of bottom padding.
 */
export function BottomNav<K extends string = string>({ items, active, onSelect, ariaLabel }: BottomNavProps<K>) {
  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-gray-200 bg-white"
    >
      <ul className="flex">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <li key={item.key} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 border-t-2 px-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 ${
                  isActive
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
