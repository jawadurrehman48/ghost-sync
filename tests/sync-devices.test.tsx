import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AppShell, QrCode, SyncDevicesSection, SyncStatusBadge, i18n } from '@skeleton/core';
import type { DeviceSync } from '@skeleton/core';
import ur from '../packages/skeleton/src/i18n/locales/ur.json';

const CODE = '0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d';
const OTHER = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';

function sync(overrides: Partial<DeviceSync> = {}): DeviceSync {
  return {
    mode: 'cloud',
    workspaceCode: CODE,
    joinUrl: `https://khata.example/#join=${CODE}`,
    join: vi.fn(async () => 'joined' as const),
    ...overrides,
  };
}

afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('"Local only" sync badge', () => {
  it('shows "Local only" when no cloud is configured, and is not clickable', () => {
    const onClick = vi.fn();
    render(<SyncStatusBadge status={{ state: 'local' }} onClick={onClick} />);
    const badge = screen.getByRole('button', { name: 'Local only' });
    expect((badge as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(badge);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByText('Synced')).toBeNull();
  });

  it('is translated in Urdu', async () => {
    await i18n.changeLanguage('ur');
    render(<AppShell appName="Khata" syncStatus={{ state: 'local' }}><div /></AppShell>);
    expect(screen.getByText(ur.sync.local)).toBeTruthy();
  });
});

describe('QrCode', () => {
  it('draws a square QR code with a quiet zone and an accessible label', () => {
    render(<QrCode value={`https://khata.example/#join=${CODE}`} label="Join code" />);
    const svg = screen.getByRole('img', { name: 'Join code' });
    const [, , w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(w).toBe(h);
    expect((w - 8 - 21) % 4).toBe(0); // 4-module border on each side, version size 21 + 4k
    expect(svg.querySelector('path')?.getAttribute('d')?.length).toBeGreaterThan(100);
  });
});

describe('Sync devices section', () => {
  it('shows the code, a QR code and the shared-secret warning', () => {
    render(<SyncDevicesSection sync={sync()} />);
    expect(screen.getByRole('heading', { name: 'Sync devices' })).toBeTruthy();
    expect(screen.getByText(CODE).getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('img', { name: "QR code to join this device's data" })).toBeTruthy();
    expect(screen.getByText(/Share it only with staff you trust/)).toBeTruthy();
  });

  it('copies the code', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SyncDevicesSection sync={sync()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Code copied'));
    expect(writeText).toHaveBeenCalledWith(CODE);
  });

  it('says so when copying is not possible', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) }, configurable: true });
    const exec = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    render(<SyncDevicesSection sync={sync()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not copy'));
  });

  it('refuses an invalid code without asking', () => {
    const s = sync();
    render(<SyncDevicesSection sync={s} />);
    fireEvent.change(screen.getByLabelText('Join another device: enter its sync code'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByText('Enter the full sync code shown on the other device')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s.join).not.toHaveBeenCalled();
  });

  it('says when the code is this device’s own', () => {
    const s = sync();
    render(<SyncDevicesSection sync={s} />);
    fireEvent.change(screen.getByLabelText('Join another device: enter its sync code'), { target: { value: CODE.toUpperCase() } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('status').textContent).toBe('This device already uses this sync code.');
    expect(s.join).not.toHaveBeenCalled();
  });

  it('asks for confirmation; Cancel changes nothing', () => {
    const s = sync();
    render(<SyncDevicesSection sync={s} />);
    fireEvent.change(screen.getByLabelText('Join another device: enter its sync code'), { target: { value: OTHER } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Join this workspace?');
    expect(dialog.textContent).toContain('This device will receive all data from that workspace');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s.join).not.toHaveBeenCalled();
  });

  it('joins after confirming (code typed without dashes) and reports it', async () => {
    const s = sync();
    const onJoined = vi.fn();
    render(<SyncDevicesSection sync={s} onJoined={onJoined} />);
    fireEvent.change(screen.getByLabelText('Join another device: enter its sync code'), { target: { value: OTHER.replace(/-/g, '').toUpperCase() } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, join' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Joined.'));
    expect(s.join).toHaveBeenCalledWith(OTHER);
    expect(onJoined).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows an error if joining fails', async () => {
    const s = sync({ join: vi.fn(async () => Promise.reject(new Error('network'))) });
    render(<SyncDevicesSection sync={s} />);
    fireEvent.change(screen.getByLabelText('Join another device: enter its sync code'), { target: { value: OTHER } });
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, join' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not join'));
  });

  it('asks straight away for a code that came from a scanned QR link', () => {
    render(<SyncDevicesSection sync={sync({ initialCode: OTHER })} />);
    expect(screen.getByRole('alertdialog').textContent).toContain('Join this workspace?');
    expect((screen.getByLabelText('Join another device: enter its sync code') as HTMLInputElement).value).toBe(OTHER);
  });

  it('in local-only mode explains that sync is off and offers no code or joining', () => {
    render(<SyncDevicesSection sync={sync({ mode: 'local' })} />);
    expect(screen.getByText(/Sync is not set up for this app/)).toBeTruthy();
    expect(screen.queryByText(CODE)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  });

  it('is fully translated in Urdu', async () => {
    await i18n.changeLanguage('ur');
    const { container } = render(<SyncDevicesSection sync={sync()} />);
    expect(screen.getByRole('heading', { name: ur.syncDevices.title })).toBeTruthy();
    expect(screen.getByRole('button', { name: ur.syncDevices.copy })).toBeTruthy();
    expect(screen.getByRole('button', { name: ur.syncDevices.joinButton })).toBeTruthy();
    expect(container.textContent ?? '').not.toMatch(/syncDevices\./);
  });
});
