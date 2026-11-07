import type { Record as SkeletonRecord } from '../storage/types';

/**
 * Pluggable adapter for syncing records to/from a backend.
 * The in-memory mock is included for development and tests.
 * A real cloud adapter (e.g. Supabase) can implement this interface.
 */
export interface SyncAdapter {
  /**
   * Push records to the backend.
   * @returns ids of records that were newly accepted (already-known ids are deduped).
   */
  push(records: SkeletonRecord<unknown>[]): Promise<string[]>;

  /**
   * Pull records from the backend that this device doesn't already have.
   * @param knownIds - ids this device already has; the adapter excludes them.
   * @returns records not in knownIds.
   */
  pull(knownIds: string[]): Promise<SkeletonRecord<unknown>[]>;
}

/**
 * In-memory mock adapter that simulates a shared cloud store.
 *
 * Multiple sync engine instances pointed at the same `InMemorySyncAdapter`
 * simulate multiple devices syncing through a shared backend.
 *
 * All collections share one adapter — records are stored in a flat Map
 * keyed by id. The `collection` field on each record is preserved so the
 * sync engine can route pulled records to the correct Dexie table.
 */
export class InMemorySyncAdapter implements SyncAdapter {
  private store = new Map<string, SkeletonRecord<unknown>>();

  async push(records: SkeletonRecord<unknown>[]): Promise<string[]> {
    const accepted: string[] = [];
    for (const record of records) {
      if (!this.store.has(record.id)) {
        this.store.set(record.id, record);
        accepted.push(record.id);
      }
    }
    return accepted;
  }

  async pull(knownIds: string[]): Promise<SkeletonRecord<unknown>[]> {
    const knownSet = new Set(knownIds);
    const result: SkeletonRecord<unknown>[] = [];
    for (const [id, record] of this.store) {
      if (!knownSet.has(id)) {
        result.push(record);
      }
    }
    return result;
  }

  // --- Test helpers ---

  /** Clear all stored records. */
  reset(): void {
    this.store.clear();
  }

  /** Number of records in the shared store. */
  size(): number {
    return this.store.size;
  }

  /** Get a record by id (for testing). */
  get(id: string): SkeletonRecord<unknown> | undefined {
    return this.store.get(id);
  }
}
