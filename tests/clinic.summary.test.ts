/**
 * TR-4: Today's Summary always matches the token states.
 */
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { deriveSummary, deriveTokens } from '../apps/clinic-queue/src/clinic.reducers';
import { DAY, arbScenario, atMin, buildScenario, emptyData, rec, shuffleData, type EventKind, type Scenario } from './clinic.helpers';

/** Independent replay: the time a token was first called (moved to serving), or null. */
function referenceFirstCall(s: Scenario, tokenIndex: number): number | null {
  const table: Record<string, Partial<Record<EventKind, string>>> = {
    waiting: { called: 'serving', skipped: 'skipped' },
    serving: { completed: 'completed', skipped: 'skipped' },
    skipped: { requeued: 'waiting' },
    completed: {},
  };
  const events = s.events
    .map((e, j) => ({ ...e, j }))
    .filter((e) => e.token % s.tokens.length === tokenIndex)
    .sort((a, b) => a.at - b.at || a.j - b.j);
  let status = 'waiting';
  for (const e of events) {
    const next = table[status][e.kind];
    if (!next) continue;
    if (next === 'serving') return e.at;
    status = next;
  }
  return null;
}

describe('TR-4: summary counts match token states', () => {
  it('issued = waiting + serving + completed + skipped, and each count matches the tokens', () => {
    fc.assert(
      fc.property(arbScenario, (s) => {
        const tokens = deriveTokens(buildScenario(s));
        const summary = deriveSummary(tokens, DAY);
        expect(summary.issued).toBe(s.tokens.length);
        expect(summary.waiting + summary.serving + summary.completed + summary.skipped).toBe(summary.issued);
        for (const status of ['waiting', 'serving', 'completed', 'skipped'] as const) {
          expect(summary[status]).toBe(tokens.filter((t) => t.status === status).length);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('arrived bars add up to issued and seen bars add up to completed', () => {
    fc.assert(
      fc.property(arbScenario, (s) => {
        const summary = deriveSummary(deriveTokens(buildScenario(s)), DAY);
        expect(summary.hours.reduce((n, h) => n + h.arrived, 0)).toBe(summary.issued);
        expect(summary.hours.reduce((n, h) => n + h.seen, 0)).toBe(summary.completed);
      }),
      { numRuns: 300 },
    );
  });

  it('hour buckets are consecutive and cover the first to the last activity', () => {
    fc.assert(
      fc.property(arbScenario, (s) => {
        const tokens = deriveTokens(buildScenario(s));
        const summary = deriveSummary(tokens, DAY);
        const activity = [
          ...tokens.map((t) => new Date(t.issuedAt).getHours()),
          ...tokens.filter((t) => t.status === 'completed').map((t) => new Date(t.completedAt as string).getHours()),
        ];
        const hours = summary.hours.map((h) => h.hour);
        expect(hours[0]).toBe(Math.min(...activity));
        expect(hours[hours.length - 1]).toBe(Math.max(...activity));
        hours.forEach((h, i) => {
          if (i > 0) expect(h).toBe(hours[i - 1] + 1);
        });
        // Every bucket's arrived count matches an independent tally.
        for (const bucket of summary.hours) {
          expect(bucket.arrived).toBe(tokens.filter((t) => new Date(t.issuedAt).getHours() === bucket.hour).length);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('average wait matches an independent calculation (issue to first call)', () => {
    fc.assert(
      fc.property(arbScenario, (s) => {
        const summary = deriveSummary(deriveTokens(buildScenario(s)), DAY);
        const waits: number[] = [];
        s.tokens.forEach((tk, i) => {
          const first = referenceFirstCall(s, i);
          if (first !== null) waits.push(Math.max(0, first - tk.at));
        });
        const expected = waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null;
        expect(summary.avgWaitMinutes).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it('the summary does not depend on the order records arrived in', () => {
    fc.assert(
      fc.property(arbScenario, fc.integer(), (s, seed) => {
        const data = buildScenario(s);
        expect(deriveSummary(deriveTokens(shuffleData(data, seed)), DAY)).toEqual(deriveSummary(deriveTokens(data), DAY));
      }),
      { numRuns: 200 },
    );
  });

  it('only counts tokens for the chosen day', () => {
    const data = emptyData();
    data.tokenIssued.push(rec('tokenIssued', { patientId: 'p-1', prefix: 'A', number: 1, date: DAY, at: atMin(0) }, 't-1', 1));
    data.tokenIssued.push(
      rec('tokenIssued', { patientId: 'p-2', prefix: 'A', number: 1, date: '2026-03-09', at: atMin(-1440) }, 't-2', 2),
    );
    const summary = deriveSummary(deriveTokens(data), DAY);
    expect(summary.issued).toBe(1);
    expect(summary.waiting).toBe(1);
  });

  it('an empty day has zero counts, no average wait and no bars', () => {
    expect(deriveSummary([], DAY)).toEqual({
      date: DAY,
      issued: 0,
      waiting: 0,
      serving: 0,
      completed: 0,
      skipped: 0,
      avgWaitMinutes: null,
      hours: [],
    });
  });

  it('a worked example: two seen, one waiting', () => {
    const data = emptyData();
    data.tokenIssued.push(rec('tokenIssued', { patientId: 'p-1', prefix: 'A', number: 1, date: DAY, at: atMin(0) }, 't-1', 1));
    data.tokenIssued.push(rec('tokenIssued', { patientId: 'p-2', prefix: 'A', number: 2, date: DAY, at: atMin(10) }, 't-2', 2));
    data.tokenIssued.push(rec('tokenIssued', { patientId: 'p-3', prefix: 'A', number: 3, date: DAY, at: atMin(20) }, 't-3', 3));
    data.tokenCalled.push(rec('tokenCalled', { tokenId: 't-1', at: atMin(5) }, 'c-1', 10));
    data.tokenCompleted.push(rec('tokenCompleted', { tokenId: 't-1', at: atMin(15) }, 'd-1', 11));
    data.tokenCalled.push(rec('tokenCalled', { tokenId: 't-2', at: atMin(25) }, 'c-2', 12));
    data.tokenCompleted.push(rec('tokenCompleted', { tokenId: 't-2', at: atMin(30) }, 'd-2', 13));
    const summary = deriveSummary(deriveTokens(data), DAY);
    expect(summary).toMatchObject({ issued: 3, waiting: 1, serving: 0, completed: 2, skipped: 0 });
    // Waits: 5 and 15 minutes, average 10.
    expect(summary.avgWaitMinutes).toBe(10);
  });
});
