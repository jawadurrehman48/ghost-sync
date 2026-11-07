import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateDeviceId, _resetMemoryDeviceId } from '@skeleton/core';

describe('deviceId', () => {
  beforeEach(() => {
    _resetMemoryDeviceId();
    localStorage.clear();
  });

  it('should generate a UUID v4 on first call', () => {
    const id = getOrCreateDeviceId();
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should persist the deviceId to localStorage', () => {
    const id = getOrCreateDeviceId();
    expect(localStorage.getItem('ghost-sync-device-id')).toBe(id);
  });

  it('should return the same id on subsequent calls', () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });

  it('should reuse a previously stored deviceId', () => {
    localStorage.setItem('ghost-sync-device-id', 'pre-existing-id');
    const id = getOrCreateDeviceId();
    expect(id).toBe('pre-existing-id');
  });

  it('should generate different ids for different devices', () => {
    _resetMemoryDeviceId();
    localStorage.clear();
    const id1 = getOrCreateDeviceId();

    _resetMemoryDeviceId();
    localStorage.clear();
    const id2 = getOrCreateDeviceId();

    expect(id1).not.toBe(id2);
  });
});
