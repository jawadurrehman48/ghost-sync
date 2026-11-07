import type { Record as RecordType } from './types';

/**
 * A pure reducer function that folds over records to produce derived state.
 * Called once per record in order (oldest first).
 */
export type Reducer<P, S> = (state: S | undefined, record: RecordType<P>) => S;

/**
 * Derive current state from a list of records using an app-supplied reducer.
 *
 * This is a pure function — it has no side effects and no Dexie dependency.
 * It simply folds the reducer over the records in order (oldest first),
 * starting from the optional `initial` state.
 *
 * @example
 * const balanceReducer: Reducer<TransactionPayload, number> = (state, record) =>
 *   (state ?? 0) + record.payload.amount;
 * const total = deriveState(records, balanceReducer, 0);
 */
export function deriveState<P, S>(
  records: RecordType<P>[],
  reducer: Reducer<P, S>,
  initial?: S,
): S {
  return records.reduce(
    (acc: S | undefined, record: RecordType<P>) => reducer(acc, record),
    initial,
  ) as S;
}
