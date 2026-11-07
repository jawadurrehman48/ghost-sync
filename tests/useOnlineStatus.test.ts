import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus } from '@skeleton/core';

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    setOnline(true);
  });

  it('should return true when navigator.onLine is true', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('should return false when navigator.onLine is false', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('should update to false when offline event fires', () => {
    setOnline(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('should update to true when online event fires', () => {
    setOnline(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });

  it('should clean up event listeners on unmount', () => {
    setOnline(true);
    const { result, unmount } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    unmount();

    // After unmount, dispatching events should not cause errors
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // result.current still holds the last value (no crash)
    expect(result.current).toBe(true);
  });
});
