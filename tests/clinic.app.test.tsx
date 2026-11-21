import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { i18n, registerAppTranslations } from '@skeleton/core';
import App from '../apps/clinic-queue/src/App';
import { db } from '../apps/clinic-queue/src/clinic.store';
import en from '../apps/clinic-queue/src/i18n/en.json';
import ur from '../apps/clinic-queue/src/i18n/ur.json';

/**
 * The real Clinic Queue app against a real (fake-indexeddb) database:
 * routing, store, sync engine, floating button, dialogs and the display.
 */
const KEY_LEAK = /clinic\.[a-zA-Z]+\.[a-zA-Z]+/;

function nav(name: string, menuLabel = 'Main menu') {
  return within(screen.getByRole('navigation', { name: menuLabel })).getByRole('button', { name });
}

async function count(table: string): Promise<number> {
  return db.table(table).count();
}

/** The floating "+" (the only "Issue token" button outside the main content). */
function fab() {
  const buttons = screen.getAllByRole('button', { name: 'Issue token' });
  return buttons[buttons.length - 1];
}

beforeAll(() => {
  registerAppTranslations({ en, ur });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'open').mockImplementation(() => null); // pop-ups blocked: the app switches this tab
});

afterAll(async () => {
  await i18n.changeLanguage('en');
  db.close();
});

describe('Clinic Queue app: a clinic day', () => {
  it('first token, call, complete, patients, summary, demo data, display, Urdu, clear all', async () => {
    render(<App />);

    // 1. An empty day invites the first token.
    expect(await screen.findByText('No patients yet today')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My Clinic' })).toBeTruthy();

    // 2. "+" → quick-register a new patient and issue A-1.
    fireEvent.click(fab());
    expect(await screen.findByText('No patients yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'New patient' })[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ayesha Khan' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '0300-1234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and issue token' }));
    expect(await screen.findByText('Token for Ayesha Khan')).toBeTruthy();
    expect(screen.getByText('A-1')).toBeTruthy();
    expect(screen.getByText('No one ahead. Next in line!')).toBeTruthy();
    expect(await count('tokenIssued')).toBe(1);
    expect(await count('deviceLetterSet')).toBe(1);

    // 3. Back on the queue: call her, then complete the visit.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Call next' }));
    expect(await screen.findByRole('button', { name: 'Complete current patient' })).toBeTruthy();
    const serving = screen.getByRole('heading', { name: 'Now serving' }).parentElement as HTMLElement;
    expect(within(serving).getByText('A-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Complete current patient' }));
    expect(await screen.findByRole('button', { name: 'No one waiting' })).toBeTruthy();
    expect(await count('tokenCompleted')).toBe(1);

    // 4. Patients: she is listed with her visit.
    fireEvent.click(nav('Patients'));
    fireEvent.click(await screen.findByText('Ayesha Khan'));
    expect(await screen.findByRole('heading', { name: 'Ayesha Khan' })).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();

    // 5. Summary: one patient seen.
    fireEvent.click(nav('Summary'));
    expect((await screen.findByText('Patients seen')).parentElement?.textContent).toContain('1');
    expect(screen.getByRole('img', { name: 'Bar chart of patients arriving and seen per hour' })).toBeTruthy();

    // 6. Demo data, once.
    fireEvent.click(nav('Settings'));
    fireEvent.click(await screen.findByRole('button', { name: 'Load demo data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, add sample data' }));
    expect(await screen.findByText('Sample data added')).toBeTruthy();
    expect(await count('patientRegistered')).toBe(11);
    fireEvent.click(screen.getByRole('button', { name: 'Load demo data' }));
    expect((await screen.findByRole('status')).textContent).toContain('already loaded');
    expect(await count('patientRegistered')).toBe(11);

    // 7. The queue now shows the demo clinic with people waiting and someone being seen.
    fireEvent.click(nav('Queue'));
    expect(await screen.findByRole('heading', { name: 'Shifa Family Clinic' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Complete & call next' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Waiting list' })).toBeTruthy();

    // 8. The waiting-room display (pop-up blocked, so this tab switches), then back.
    fireEvent.click(screen.getByRole('button', { name: 'Waiting-room display' }));
    expect(await screen.findByRole('button', { name: 'Exit display' })).toBeTruthy();
    expect(screen.getByText('Updates automatically')).toBeTruthy();
    expect(screen.queryByText('Ayesha Khan')).toBeNull(); // no names on the public screen
    fireEvent.click(screen.getByRole('button', { name: 'Exit display' }));
    expect(await screen.findByRole('navigation', { name: 'Main menu' })).toBeTruthy();

    // 9. Urdu: the whole app switches, right-to-left, no raw keys.
    fireEvent.click(nav('Settings'));
    fireEvent.click(await screen.findByLabelText('اردو'));
    await waitFor(() => expect(document.documentElement.dir).toBe('rtl'));
    const urNav = await screen.findByRole('navigation', { name: ur.clinic.nav.ariaLabel });
    expect(within(urNav).getByRole('button', { name: ur.clinic.nav.queue })).toBeTruthy();
    fireEvent.click(within(urNav).getByRole('button', { name: ur.clinic.nav.queue }));
    expect(await screen.findByRole('button', { name: ur.clinic.queue.completeAndCallNext })).toBeTruthy();
    expect(document.body.textContent ?? '').not.toMatch(KEY_LEAK);
    fireEvent.click(within(urNav).getByRole('button', { name: ur.clinic.nav.settings }));
    fireEvent.click(await screen.findByLabelText('English'));
    await waitFor(() => expect(document.documentElement.dir).toBe('ltr'));

    // 10. Clear all data after confirming.
    fireEvent.click(await screen.findByRole('button', { name: 'Clear all data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, delete everything' }));
    expect(await screen.findByText('All data was deleted')).toBeTruthy();
    expect(await count('patientRegistered')).toBe(0);
    expect(await count('tokenIssued')).toBe(0);
    fireEvent.click(nav('Queue'));
    expect(await screen.findByText('No patients yet today')).toBeTruthy();
  });
});
