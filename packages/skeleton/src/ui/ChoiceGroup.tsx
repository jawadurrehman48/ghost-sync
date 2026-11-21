import { useId } from 'react';

export interface Choice<V extends string = string> {
  value: V;
  label: string;
}

export interface ChoiceGroupProps<V extends string = string> {
  /** Visible group label (a translated string). */
  label: string;
  options: Choice<V>[];
  /** The selected value, or null for none. */
  value: V | null;
  onChange: (value: V) => void;
  /** Lets the user clear the choice by tapping the selected option again. */
  allowDeselect?: boolean;
}

/**
 * A row of large option buttons that behaves like radio buttons (a native
 * radio group underneath, so arrow keys and screen readers work). Each option
 * is at least 48px tall. Order mirrors automatically in RTL.
 */
export function ChoiceGroup<V extends string = string>({
  label,
  options,
  value,
  onChange,
  allowDeselect = false,
}: ChoiceGroupProps<V>) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-gray-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`inline-flex min-h-[48px] min-w-[48px] flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-base font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600 ${
                checked
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                onClick={() => {
                  if (allowDeselect && checked) onChange('' as V);
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
