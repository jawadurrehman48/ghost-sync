import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { i18n, registerAppTranslations } from '@skeleton/core';
import App from '../apps/khata/src/App';
import { db } from '../apps/khata/src/khata.store';
import en from '../apps/khata/src/i18n/en.json';
import ur from '../apps/khata/src/i18n/ur.json';

/**
 * The real app against a real (fake-indexeddb) database: routing, store, sync
 * engine, floating button, dialogs. Runs one customer journey end to end.
 */
const KEY_LEAK = /khata\.[a-z]+\.[a-zA-Z]+/;

/** The bottom tab bar; its accessible name is translated too ("Main menu" / "مین مینو"). */
function nav(name: string, menuLabel = 'Main menu') {
  return within(screen.getByRole('navigation', { name: menuLabel })).getByRole('button', { name });
}

async function count(table: string): Promise<number> {
  return db.table(table).count();
}

beforeAll(() => {
  registerAppTranslations({ en, ur });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterAll(async () => {
  await i18n.changeLanguage('en');
  db.close();
});

describe('Khata app: a shopkeeper’s journey', () => {
  it('welcome, demo data once, quick entry, reports, clear all data, demo again', async () => {
    render(<App />);

    // 1. A brand-new shop is welcomed, not shown empty cards.
    expect(await screen.findByText('Welcome to Khata')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quick entry' })).not.toBeNull(); // "+" is available from the start

    // 2. Load the demo data from Settings.
    fireEvent.click(nav('Settings'));
    await screen.findByText('Danger zone');
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, add sample data' }));
    expect(await screen.findByText('Sample data added')).toBeTruthy();
    expect(await count('customerCreated')).toBe(8);

    // 3. Pressing it again adds nothing and says so.
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    expect((await screen.findByRole('status')).textContent).toContain('already loaded');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await count('customerCreated')).toBe(8);
    expect(await count('entryReversed')).toBe(1);

    // 4. The dashboard shows the demo shop.
    fireEvent.click(nav('Home'));
    expect(await screen.findByText('Rs 15,720')).toBeTruthy();
    expect(screen.getByText('6 customers owe you money')).toBeTruthy();
    expect(screen.getByText('Al-Madina General Store')).toBeTruthy();
    const debtors = screen.getByRole('region', { name: 'Customers Who Owe the Most' });
    expect(within(debtors).getAllByRole('button')).toHaveLength(5);

    // 5. Quick entry with the floating "+": find a customer, add Rs 500 credit.
    fireEvent.click(screen.getByRole('button', { name: 'Quick entry' }));
    fireEvent.change(await screen.findByLabelText('Search customer by name or phone'), { target: { value: 'imran' } });
    fireEvent.click(screen.getByText('Imran Hussain'));
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Imran Hussain' })).toBeTruthy();
    expect((await screen.findAllByText('Rs 5,230')).length).toBeGreaterThan(0); // 4,730 + 500
    expect(await count('creditGiven')).toBeGreaterThan(0);

    // 6. The customers tab lists everyone and also has the "+" button.
    fireEvent.click(nav('Customers'));
    for (const name of ['Muhammad Aslam', 'Rukhsana Bibi', 'Imran Hussain', 'Ayesha Siddiqui', 'Zahid Mehmood', 'Naseem Akhtar', 'Shabana Kausar', 'Tariq Javed']) {
      expect(await screen.findByText(name)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Quick entry' })).toBeTruthy();

    // 7. Settings, Reports and customer pages do not show the "+".
    fireEvent.click(nav('Reports'));
    await screen.findByRole('img', { name: /Bar chart/ });
    expect(screen.queryByRole('button', { name: 'Quick entry' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    // today's demo entries (Rs 450 + Rs 640) plus the Rs 500 just added
    expect(within(screen.getByLabelText('Reports')).getByText('Rs 1,590')).toBeTruthy();

    // 8. Clear all data: dialog, confirm, everything is gone and the welcome returns.
    fireEvent.click(nav('Settings'));
    fireEvent.click(await screen.findByRole('button', { name: 'Clear all data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, delete everything' }));
    expect(await screen.findByText('All data was deleted')).toBeTruthy();
    await waitFor(async () => {
      expect(await count('customerCreated')).toBe(0);
      expect(await count('creditGiven')).toBe(0);
      expect(await count('settingsUpdated')).toBe(0);
    });
    fireEvent.click(nav('Home'));
    expect(await screen.findByText('Welcome to Khata')).toBeTruthy();

    // 9. After clearing, the demo can be loaded again (its marker was cleared too).
    fireEvent.click(nav('Settings'));
    fireEvent.click(await screen.findByRole('button', { name: 'Load Demo Data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, add sample data' }));
    expect(await screen.findByText('Sample data added')).toBeTruthy();
    expect(await count('customerCreated')).toBe(8);
  }, 60_000);

  it('Urdu mode: right-to-left, translated everywhere, and the "+" button moves to the end side', async () => {
    render(<App />);
    await screen.findByText('Rs 15,720', undefined, { timeout: 5000 }).catch(() => undefined);

    fireEvent.click(await screen.findByRole('button', { name: 'Switch language' }));
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    expect(document.documentElement.lang).toBe('ur');

    // navigation and the floating button are translated
    const urduNav = (name: string) => nav(name, 'مین مینو');
    expect(urduNav('ہوم')).toBeTruthy();
    expect(urduNav('گاہک')).toBeTruthy();
    expect(urduNav('رپورٹس')).toBeTruthy();
    expect(urduNav('سیٹنگز')).toBeTruthy();
    const fab = await screen.findByRole('button', { name: 'فوری اندراج' });

    // the "+" sits on the END side via logical classes, so it is on the left in Urdu
    expect(fab.parentElement?.className).toContain('justify-end');
    expect(fab.parentElement?.className).toContain('pe-4');
    expect(fab.parentElement?.className).not.toMatch(/\b(right|left)-/);

    // no untranslated keys anywhere
    expect(document.body.textContent ?? '').not.toMatch(KEY_LEAK);

    // every tab renders in Urdu without leaking keys
    for (const tab of ['گاہک', 'رپورٹس', 'سیٹنگز', 'ہوم']) {
      fireEvent.click(urduNav(tab));
      await waitFor(() => expect(document.body.textContent ?? '').not.toMatch(KEY_LEAK));
    }

    // and back to English
    fireEvent.click(screen.getByRole('button', { name: 'زبان تبدیل کریں' }));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));
  }, 60_000);
});
