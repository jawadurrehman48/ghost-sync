import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import {
  BottomNav,
  ScreenHeader,
  useStoreSnapshot,
  createSyncStatusStore,
  type SyncEngine,
  type SyncStatus,
} from '@skeleton/core';

describe('BottomNav', () => {
  const items = [
    { key: 'a', label: 'Home' },
    { key: 'b', label: 'People' },
    { key: 'c', label: 'Reports' },
  ];

  it('renders every tab label inside a labelled navigation landmark', () => {
    render(<BottomNav items={items} active="a" onSelect={() => {}} ariaLabel="Main" />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    for (const item of items) expect(screen.getByText(item.label)).toBeTruthy();
  });

  it('marks only the active tab with aria-current', () => {
    render(<BottomNav items={items} active="b" onSelect={() => {}} />);
    expect(screen.getByText('People').closest('button')?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByText('Home').closest('button')?.getAttribute('aria-current')).toBeNull();
  });

  it('calls onSelect with the tapped tab key', () => {
    const onSelect = vi.fn();
    render(<BottomNav items={items} active="a" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Reports'));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('gives every tab a touch target of at least 44px', () => {
    render(<BottomNav items={items} active="a" onSelect={() => {}} />);
    for (const item of items) {
      expect(screen.getByText(item.label).closest('button')?.className).toContain('min-h-[56px]');
    }
  });
});

describe('ScreenHeader', () => {
  it('shows the title and no back button by default', () => {
    render(<ScreenHeader title="Customers" />);
    expect(screen.getByText('Customers')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows an accessible back button that calls onBack', () => {
    const onBack = vi.fn();
    render(<ScreenHeader title="Detail" onBack={onBack} backLabel="Back" />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('mirrors the back chevron in RTL', () => {
    render(<ScreenHeader title="Detail" onBack={() => {}} backLabel="Back" />);
    expect(screen.getByRole('button', { name: 'Back' }).querySelector('svg')?.getAttribute('class')).toContain(
      'rtl:rotate-180',
    );
  });
});

describe('useStoreSnapshot', () => {
  it('loads data on mount', async () => {
    const load = vi.fn(async () => ['a', 'b']);
    const { result } = renderHook(() => useStoreSnapshot(load));
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data).toEqual(['a', 'b']));
  });

  it('reloads on demand and shows the newest data', async () => {
    let value = 1;
    const { result } = renderHook(() => useStoreSnapshot(async () => value));
    await waitFor(() => expect(result.current.data).toBe(1));
    value = 2;
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe(2);
  });

  it('keeps only the latest result when reloads overlap', async () => {
    const resolvers: Array<(v: string) => void> = [];
    const load = () => new Promise<string>((resolve) => resolvers.push(resolve));
    const { result } = renderHook(() => useStoreSnapshot(load));
    // the mount load is call #1; start call #2 before #1 resolves
    let second: Promise<void> = Promise.resolve();
    act(() => {
      second = result.current.reload();
    });
    await act(async () => {
      resolvers[1]('newest');
      await second;
    });
    await act(async () => {
      resolvers[0]('stale');
      await Promise.resolve();
    });
    expect(result.current.data).toBe('newest');
  });

  it('reports a load error instead of throwing', async () => {
    const { result } = renderHook(() =>
      useStoreSnapshot(async () => {
        throw new Error('disk full');
      }),
    );
    await waitFor(() => expect((result.current.error as Error).message).toBe('disk full'));
  });

  it('reloads when the sync engine status changes (but not on the initial callback)', async () => {
    const statusStore = createSyncStatusStore({ state: 'synced' } as SyncStatus);
    const engine = {
      subscribe: statusStore.subscribe,
      getStatus: statusStore.get,
      syncNow: async () => {},
      start: () => {},
      stop: () => {},
    } satisfies SyncEngine;
    const load = vi.fn(async () => Date.now());

    renderHook(() => useStoreSnapshot(load, { engine }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    await act(async () => {
      statusStore.set({ state: 'syncing' });
      await Promise.resolve();
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
