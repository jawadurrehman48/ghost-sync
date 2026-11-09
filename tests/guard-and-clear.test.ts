import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import Dexie from 'dexie';
import { clearAllData, createDatabase, createStore, useSubmitGuard } from '@skeleton/core';

describe('useSubmitGuard', () => {
  it('runs the task and reports busy while it is in flight', async () => {
    const { result } = renderHook(() => useSubmitGuard());
    let finish: (v: string) => void = () => {};
    let promise: Promise<string | undefined> = Promise.resolve(undefined);

    act(() => {
      promise = result.current.run(() => new Promise<string>((resolve) => (finish = resolve)));
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      finish('done');
      await promise;
    });
    expect(await promise).toBe('done');
    expect(result.current.busy).toBe(false);
  });

  it('ignores a second tap while the first is still running, even in the same frame', async () => {
    const { result } = renderHook(() => useSubmitGuard());
    let calls = 0;
    let finish: () => void = () => {};
    const task = () =>
      new Promise<void>((resolve) => {
        calls++;
        finish = resolve;
      });

    let first: Promise<void | undefined> = Promise.resolve();
    let second: Promise<void | undefined> = Promise.resolve();
    act(() => {
      first = result.current.run(task);
      second = result.current.run(task); // double tap before React re-renders
    });

    await act(async () => {
      finish();
      await Promise.all([first, second]);
    });
    expect(calls).toBe(1);
    expect(await second).toBeUndefined();
  });

  it('allows a new run after the previous one finished or failed', async () => {
    const { result } = renderHook(() => useSubmitGuard());
    await act(async () => {
      await expect(result.current.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });
    expect(result.current.busy).toBe(false);

    let value: number | undefined;
    await act(async () => {
      value = await result.current.run(async () => 42);
    });
    expect(value).toBe(42);
  });
});

type Cols = { a: { n: number }; b: { s: string } };
const NAME = `clear-test-${Date.now()}`;
let db: ReturnType<typeof createDatabase<Cols>>;

describe('clearAllData', () => {
  afterEach(async () => {
    db?.close();
    await Dexie.delete(NAME);
  });

  it('erases every collection but leaves the database usable', async () => {
    db = createDatabase<Cols>({ dbName: NAME, collections: { a: undefined, b: undefined } });
    const store = createStore(db, 'device-1');
    await store.add('a', { n: 1 });
    await store.add('a', { n: 2 });
    await store.add('b', { s: 'x' });
    expect(await store.getAllIds()).toHaveLength(3);

    await clearAllData(db);

    expect(await store.query('a')).toEqual([]);
    expect(await store.query('b')).toEqual([]);
    expect(await store.getAllIds()).toEqual([]);
    expect(await store.getPending()).toEqual([]);

    const fresh = await store.add('a', { n: 3 });
    expect((await store.query('a')).map((r) => r.id)).toEqual([fresh.id]);
  });

  it('is safe on an already empty database', async () => {
    db = createDatabase<Cols>({ dbName: NAME, collections: { a: undefined, b: undefined } });
    await expect(clearAllData(db)).resolves.toBeUndefined();
  });
});
