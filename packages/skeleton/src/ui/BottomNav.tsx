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
 * Each tab is at least 56px tall. Order flips automatically in RTL because
 * it is a flex row. Pages using it should leave ~80px of bottom padding.
 */
export function BottomNav<K extends string = string>({
  items,
  active,
  onSelect,
  ariaLabel,
}: BottomNavProps<K>) {
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
                className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium ${
                  isActive ? 'text-indigo-700' : 'text-gray-600 hover:text-gray-900'
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
