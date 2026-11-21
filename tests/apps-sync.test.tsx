import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { i18n, registerAppTranslations } from '@skeleton/core';
import KhataApp from '../apps/khata/src/App';
import { sync as khataSync } from '../apps/khata/src/khata.store';
import ClinicApp from '../apps/clinic-queue/src/App';
import { sync as clinicSync } from '../apps/clinic-queue/src/clinic.store';
import khataEn from '../apps/khata/src/i18n/en.json';
import khataUr from '../apps/khata/src/i18n/ur.json';
import clinicEn from '../apps/clinic-queue/src/i18n/en.json';
import clinicUr from '../apps/clinic-queue/src/i18n/ur.json';

/** Both real apps, wired the way they run: under tests the in-memory stand-in for the cloud. */
const OTHER = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';

beforeAll(() => {
  registerAppTranslations({ en: { ...khataEn, ...clinicEn }, ur: { ...khataUr, ...clinicUr } });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterAll(async () => {
  await i18n.changeLanguage('en');
});

function nav(name: string) {
  return within(screen.getByRole('navigation', { name: 'Main menu' })).getByRole('button', { name });
}

describe.each([
  ['Khata', KhataApp, khataSync],
  ['Clinic Queue', ClinicApp, clinicSync],
])('%s: sync devices', (_name, App, sync) => {
  it('uses the in-memory stand-in under tests (no Supabase variables)', () => {
    expect(sync.mode).toBe('memory');
  });

  it('opens Settings from a #join= link and asks to join; confirming switches the code', async () => {
    window.history.replaceState(null, '', `/#join=${OTHER}`);
    render(<App />);
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Join this workspace?');
    expect(window.location.hash).toBe(''); // the code is removed from the address bar
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, join' }));
    await waitFor(() => expect(screen.getByText(/^Joined\./)).toBeTruthy());
    expect(sync.getWorkspaceId()).toBe(OTHER);
    expect(screen.getByText(OTHER)).toBeTruthy();
    cleanup();
  });

  it('"Clear all data" leaves the workspace: a new sync code is shown', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    await screen.findByRole('navigation', { name: 'Main menu' });
    fireEvent.click(nav('Settings'));
    expect(await screen.findByRole('heading', { name: 'Sync devices' })).toBeTruthy();
    const before = sync.getWorkspaceId();
    expect(screen.getByText(before)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toMatch(/new sync code/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, delete everything' }));
    await waitFor(() => expect(sync.getWorkspaceId()).not.toBe(before));
    expect(await screen.findByText(sync.getWorkspaceId())).toBeTruthy();
    cleanup();
  });
});
