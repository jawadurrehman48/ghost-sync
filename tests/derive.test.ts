import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { deriveState, type SkeletonRecord } from '@skeleton/core';

// Helper: generate arbitrary records with a numeric payload
const arbRecord = fc.record({
  id: fc.uuid(),
  createdAt: fc.string({ minLength: 1 }),
  deviceId: fc.uuid(),
  collection: fc.constant('test'),
  payload: fc.record({ value: fc.integer({ min: -1000000, max: 1000000 }) }),
});

const arbRecords = fc.array(arbRecord, { maxLength: 100 });

describe('deriveState (property-based)', () => {
  it('should equal a manual reduce fold for a sum reducer', () => {
    fc.assert(
      fc.property(arbRecords, (records) => {
        const sumReducer = (state: number | undefined, r: SkeletonRecord<{ value: number }>) =>
          (state ?? 0) + r.payload.value;

        const expected = records.reduce((acc, r) => sumReducer(acc, r), 0 as number | undefined);
        const actual = deriveState(records, sumReducer as any, 0);

        return actual === expected;
      }),
    );
  });

  it('should be deterministic — same records + reducer always produce the same result', () => {
    fc.assert(
      fc.property(arbRecords, (records) => {
        const maxReducer = (state: number | undefined, r: SkeletonRecord<{ value: number }>) =>
          state === undefined ? r.payload.value : Math.max(state, r.payload.value);

        const first = deriveState(records, maxReducer as any);
        const second = deriveState(records, maxReducer as any);

        return first === second;
      }),
    );
  });

  it('should produce the same result regardless of record order when using a commutative reducer', () => {
    fc.assert(
      fc.property(arbRecords, (records) => {
        // Sum is commutative + associative, so order doesn't matter
        const sumReducer = (state: number | undefined, r: SkeletonRecord<{ value: number }>) =>
          (state ?? 0) + r.payload.value;

        const shuffled = [...records].reverse(); // reverse order
        const originalResult = deriveState(records, sumReducer as any, 0);
        const shuffledResult = deriveState(shuffled, sumReducer as any, 0);

        return originalResult === shuffledResult;
      }),
    );
  });

  it('should handle empty record lists', () => {
    fc.assert(
      fc.property(fc.constant([]), (records) => {
        const reducer = (state: number | undefined) => state ?? 0;
        const result = deriveState(records, reducer as any, 0);
        return result === 0;
      }),
    );
  });

  it('should respect the initial value', () => {
    fc.assert(
      fc.property(arbRecords, fc.integer({ min: -1000, max: 1000 }), (records, initial) => {
        const sumReducer = (state: number | undefined, r: SkeletonRecord<{ value: number }>) =>
          (state ?? 0) + r.payload.value;

        const expected = records.reduce((acc, r) => sumReducer(acc, r), initial as number | undefined);
        const actual = deriveState(records, sumReducer as any, initial);

        return actual === expected;
      }),
    );
  });
});
