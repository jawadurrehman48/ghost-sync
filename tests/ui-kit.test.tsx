import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBoundary,
  FloatingActionButton,
  GroupedBarChart,
  LoadingState,
  Notice,
  TextAreaField,
  TextField,
  formatPhone,
  i18n,
} from '@skeleton/core';

afterEach(() => cleanup());

describe('Button', () => {
  it('is a 48px full-width button by default and 44px when small', () => {
    render(
      <>
        <Button>Save</Button>
        <Button size="sm">Edit</Button>
      </>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.className).toContain('min-h-[48px]');
    expect(save.className).toContain('w-full');
    const edit = screen.getByRole('button', { name: 'Edit' });
    expect(edit.className).toContain('min-h-[44px]');
    expect(edit.className).not.toContain('w-full');
  });

  it('uses the brand colour for primary and red/green for danger/success', () => {
    render(
      <>
        <Button>P</Button>
        <Button variant="danger">D</Button>
        <Button variant="success">S</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'P' }).className).toContain('bg-brand-600');
    expect(screen.getByRole('button', { name: 'D' }).className).toContain('bg-red-600');
    expect(screen.getByRole('button', { name: 'S' }).className).toContain('bg-green-700');
  });

  it('while loading it is disabled, busy, and ignores taps', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).getAttribute('type')).toBe('button');
  });

  it('renders a safe link when given href, adding noopener for new tabs', () => {
    render(
      <Button href="https://wa.me/923001234567" target="_blank">
        WhatsApp
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'WhatsApp' });
    expect(link.getAttribute('href')).toBe('https://wa.me/923001234567');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.className).toContain('min-h-[48px]');
  });
});

describe('Card', () => {
  it('is a plain container by default', () => {
    const { container } = render(<Card>Hi</Card>);
    expect(container.querySelector('button')).toBeNull();
    expect(container.firstElementChild?.className).toContain('rounded-xl');
  });

  it('becomes a full-width button (56px) when clickable', () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Open me</Card>);
    const button = screen.getByRole('button', { name: 'Open me' });
    expect(button.className).toContain('min-h-[56px]');
    expect(button.className).toContain('text-start');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has a muted tone for inactive items', () => {
    const { container } = render(<Card tone="muted">Old</Card>);
    expect(container.firstElementChild?.className).toContain('bg-gray-50');
  });
});

describe('TextField / TextAreaField', () => {
  it('connects the label to the input', () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText('Name').tagName).toBe('INPUT');
  });

  it('shows an error, marks the field invalid and links the message for screen readers', () => {
    render(<TextField label="Phone" error="Wrong number" />);
    const input = screen.getByLabelText('Phone');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const message = screen.getByRole('alert');
    expect(message.textContent).toBe('Wrong number');
    expect(input.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('shows a hint when there is no error', () => {
    render(<TextField label="Amount" hint="Whole rupees" />);
    const input = screen.getByLabelText('Amount');
    expect(screen.getByText('Whole rupees').id).toBe(input.getAttribute('aria-describedby'));
  });

  it('can hide the label visually but keep it for screen readers', () => {
    render(<TextField label="Search" hideLabel />);
    expect(screen.getByText('Search').className).toContain('sr-only');
    expect(screen.getByLabelText('Search')).toBeTruthy();
  });

  it('has a big 56px variant for amounts and passes input props through', () => {
    render(<TextField label="Amount" size="lg" inputMode="numeric" maxLength={9} />);
    const input = screen.getByLabelText('Amount');
    expect(input.className).toContain('min-h-[56px]');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('maxlength')).toBe('9');
  });

  it('textarea works the same way', () => {
    render(<TextAreaField label="Note" error="Too long" />);
    const area = screen.getByLabelText('Note');
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('ConfirmDialog', () => {
  const base = {
    title: 'Delete?',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  };

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...base} open={false} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('is a labelled modal alertdialog that focuses Cancel first', () => {
    render(<ConfirmDialog {...base} open onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('This cannot be undone.').id).toBe(dialog.getAttribute('aria-describedby'));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('confirm and cancel call the right handlers', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape and a tap on the backdrop cancel; a tap inside does not', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open onConfirm={() => {}} onCancel={onCancel} />);
    const dialog = screen.getByRole('alertdialog');
    fireEvent.mouseDown(dialog);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab focus inside the dialog', () => {
    render(<ConfirmDialog {...base} open onConfirm={() => {}} onCancel={() => {}} />);
    const dialog = screen.getByRole('alertdialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('the danger tone uses a red confirm button', () => {
    render(<ConfirmDialog {...base} open tone="danger" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-red-600');
  });

  it('while busy, Escape and the backdrop do nothing and the buttons are disabled', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} open busy onConfirm={() => {}} onCancel={onCancel} />);
    const dialog = screen.getByRole('alertdialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onCancel).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('returns focus to the button that opened it', () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button type="button">Opener</button>
          <ConfirmDialog {...base} open={open} onConfirm={() => {}} onCancel={() => {}} />
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    screen.getByRole('button', { name: 'Opener' }).focus();
    rerender(<Harness open />);
    expect(document.activeElement?.textContent).toBe('Cancel');
    rerender(<Harness open={false} />);
    expect(document.activeElement?.textContent).toBe('Opener');
  });
});

describe('EmptyState', () => {
  it('shows the title, description and an action button', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Nothing yet" description="Add one" actionLabel="Add" onAction={onAction} />);
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeTruthy();
    expect(screen.getByText('Add one')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('has no button without both a label and a handler', () => {
    render(<EmptyState title="Nothing" actionLabel="Add" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('FloatingActionButton', () => {
  it('is a 56px round button with an accessible name and a tooltip', () => {
    const onClick = vi.fn();
    render(<FloatingActionButton label="Quick entry" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Quick entry' });
    expect(button.className).toContain('h-14');
    expect(button.className).toContain('w-14');
    expect(button.getAttribute('title')).toBe('Quick entry');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sits at the END side above the bottom navigation, inside the phone column (logical classes only)', () => {
    render(<FloatingActionButton label="Add" onClick={() => {}} />);
    const wrapper = screen.getByRole('button', { name: 'Add' }).parentElement as HTMLElement;
    expect(wrapper.className).toContain('justify-end'); // right in LTR, left in RTL
    expect(wrapper.className).toContain('pe-4');
    expect(wrapper.className).toContain('max-w-md');
    expect(wrapper.className).toContain('bottom-[80px]'); // above the 56px tab bar
    expect(wrapper.className).not.toMatch(/\b(left|right)-/);
  });
});

describe('Notice', () => {
  it('announces errors immediately and other messages politely', () => {
    render(
      <>
        <Notice tone="error">Failed</Notice>
        <Notice tone="success">Saved</Notice>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Failed');
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it('includes an icon so colour is not the only signal', () => {
    const { container } = render(<Notice tone="error">x</Notice>);
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('LoadingState', () => {
  it('announces loading with the translated default text', async () => {
    await i18n.changeLanguage('en');
    render(<LoadingState />);
    expect(screen.getByRole('status').textContent).toContain('Loading');
  });

  it('accepts a custom label', () => {
    render(<LoadingState label="Opening ledger" />);
    expect(screen.getByRole('status').textContent).toContain('Opening ledger');
  });
});

describe('ErrorBoundary', () => {
  function Boom(): never {
    throw new Error('render failed');
  }

  it('shows a friendly message instead of a blank screen, and Try again recovers', async () => {
    await i18n.changeLanguage('en');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let crash = true;
    function MaybeBoom() {
      if (crash) return <Boom />;
      return <p>All good</p>;
    }
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <MaybeBoom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong');
    expect(screen.getByRole('alert').textContent).toContain('Your data is safe');
    expect(onError).toHaveBeenCalledTimes(1);

    crash = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('All good')).toBeTruthy();
    spy.mockRestore();
  });

  it('is translated in Urdu', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await i18n.changeLanguage('ur');
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toContain('کچھ غلط ہو گیا');
    await i18n.changeLanguage('en');
    spy.mockRestore();
  });
});

describe('GroupedBarChart', () => {
  const series = [
    { key: 'a', label: 'Credit', barClassName: 'fill-red-600', swatchClassName: 'bg-red-600' },
    { key: 'b', label: 'Payments', barClassName: 'fill-green-700', swatchClassName: 'bg-green-700' },
  ];

  it('draws one bar per non-zero value and a legend, as an accessible image', () => {
    const { container } = render(
      <GroupedBarChart
        ariaLabel="Chart"
        description="Totals"
        series={series}
        groups={[
          { label: '01/03', values: [100, 0] },
          { label: '02/03', values: [50, 25] },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Chart' })).toBeTruthy();
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(screen.getByText('Credit')).toBeTruthy();
    expect(screen.getByText('Payments')).toBeTruthy();
    expect(screen.getByText('Totals').className).toContain('sr-only');
  });

  it('renders nothing for empty data', () => {
    const { container } = render(<GroupedBarChart ariaLabel="Chart" series={series} groups={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('stays left-to-right inside an Urdu page', () => {
    const { container } = render(
      <GroupedBarChart ariaLabel="Chart" series={series} groups={[{ label: 'x', values: [1, 1] }]} />,
    );
    expect(container.firstElementChild?.getAttribute('dir')).toBe('ltr');
  });

  it('anchors the first and last axis labels inwards so they are never clipped', () => {
    const { container } = render(
      <GroupedBarChart
        ariaLabel="Chart"
        series={series}
        groups={[
          { label: 'first', values: [1, 0] },
          { label: 'mid', values: [1, 0] },
          { label: 'last', values: [1, 0] },
        ]}
      />,
    );
    const anchors = [...container.querySelectorAll('text')].map((t) => t.getAttribute('text-anchor'));
    expect(anchors).toEqual(['start', 'middle', 'end']);
  });

  it('property: never draws NaN, negative or out-of-bounds bars for any data', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.oneof(fc.double({ noNaN: false }), fc.integer({ min: -1e9, max: 1e12 })),
            fc.oneof(fc.double({ noNaN: false }), fc.integer({ min: -1e9, max: 1e12 })),
          ),
          { minLength: 1, maxLength: 60 },
        ),
        (pairs) => {
          const { container, unmount } = render(
            <GroupedBarChart
              ariaLabel="Chart"
              series={series}
              groups={pairs.map(([a, b], i) => ({ label: String(i), values: [a, b] }))}
            />,
          );
          expect(container.innerHTML).not.toContain('NaN');
          expect(container.innerHTML).not.toContain('Infinity');
          for (const rect of container.querySelectorAll('rect')) {
            const y = Number(rect.getAttribute('y'));
            const h = Number(rect.getAttribute('height'));
            expect(h).toBeGreaterThan(0);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y + h).toBeLessThanOrEqual(160);
          }
          unmount();
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('formatPhone (property-based)', () => {
  const arbMobile = fc
    .array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 })
    .map((d) => `03${d.join('')}`);

  it('shows any valid mobile number as 0300-1234567', () => {
    fc.assert(
      fc.property(arbMobile, (phone) => {
        const shown = formatPhone(phone);
        expect(shown).toMatch(/^03\d{2}-\d{7}$/);
        expect(shown.replace('-', '')).toBe(phone);
      }),
    );
  });

  it('formats regardless of how it was typed (spaces, hyphens, Urdu digits)', () => {
    expect(formatPhone('03001234567')).toBe('0300-1234567');
    expect(formatPhone('0300 1234567')).toBe('0300-1234567');
    expect(formatPhone('0300-1234567')).toBe('0300-1234567');
    expect(formatPhone('۰۳۰۰۱۲۳۴۵۶۷')).toBe('0300-1234567');
  });

  it('leaves anything that is not a valid mobile number exactly as it was', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (text) => {
        const shown = formatPhone(text);
        if (!/^03\d{2}-\d{7}$/.test(shown)) expect(shown).toBe(text);
      }),
    );
  });
});
