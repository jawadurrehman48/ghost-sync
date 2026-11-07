import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell, SyncStatusBadge, LanguageToggle } from '@skeleton/core';

describe('SyncStatusBadge', () => {
  it('should show "Synced" for synced status', () => {
    render(<SyncStatusBadge status={{ state: 'synced' }} />);
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('should show count for pending status', () => {
    render(<SyncStatusBadge status={{ state: 'pending', count: 5 }} />);
    expect(screen.getByText('5 pending')).toBeTruthy();
  });

  it('should show "Offline" for offline status', () => {
    render(<SyncStatusBadge status={{ state: 'offline' }} />);
    expect(screen.getByText('Offline')).toBeTruthy();
  });

  it('should show "Syncing" for syncing status', () => {
    render(<SyncStatusBadge status={{ state: 'syncing' }} />);
    expect(screen.getByText('Syncing')).toBeTruthy();
  });

  it('should show "Error" for error status', () => {
    render(<SyncStatusBadge status={{ state: 'error', message: 'fail' }} />);
    expect(screen.getByText('Error')).toBeTruthy();
  });

  it('should call onClick when clicked and not syncing', () => {
    const onClick = vi.fn();
    render(<SyncStatusBadge status={{ state: 'synced' }} onClick={onClick} />);
    fireEvent.click(screen.getByText('Synced'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when syncing', () => {
    const onClick = vi.fn();
    render(<SyncStatusBadge status={{ state: 'syncing' }} onClick={onClick} />);
    fireEvent.click(screen.getByText('Syncing'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('LanguageToggle', () => {
  it('should show Urdu label when English is active', () => {
    render(<LanguageToggle language="en" onToggle={() => {}} />);
    expect(screen.getByText('اردو')).toBeTruthy();
  });

  it('should show English label when Urdu is active', () => {
    render(<LanguageToggle language="ur" onToggle={() => {}} />);
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('should call onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<LanguageToggle language="en" onToggle={onToggle} />);
    fireEvent.click(screen.getByText('اردو'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('AppShell', () => {
  it('should render the app name in the header', () => {
    render(<AppShell appName="Test App"><div>Content</div></AppShell>);
    expect(screen.getByText('Test App')).toBeTruthy();
  });

  it('should render children in the content area', () => {
    render(<AppShell appName="Test App"><div data-testid="child">Hello World</div></AppShell>);
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('should render sync status badge when syncStatus is provided', () => {
    render(
      <AppShell appName="Test" syncStatus={{ state: 'synced' }}>
        <div>Content</div>
      </AppShell>,
    );
    expect(screen.getByText('Synced')).toBeTruthy();
  });

  it('should render language toggle when language and onToggleLanguage are provided', () => {
    render(
      <AppShell appName="Test" language="en" onToggleLanguage={() => {}}>
        <div>Content</div>
      </AppShell>,
    );
    expect(screen.getByText('اردو')).toBeTruthy();
  });

  it('should not render sync badge or language toggle when not provided', () => {
    render(<AppShell appName="Test"><div>Content</div></AppShell>);
    expect(screen.queryByText('Synced')).toBeNull();
    expect(screen.queryByText('اردو')).toBeNull();
  });
});
