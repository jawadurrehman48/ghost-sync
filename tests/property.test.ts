import { describe, it } from 'vitest';
import * as fc from 'fast-check';

describe('Property-Based Testing with fast-check', () => {
  it('reversing an array twice should return the original array', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const reversed = arr.slice().reverse().reverse();
        return JSON.stringify(reversed) === JSON.stringify(arr);
      })
    );
  });

  it('adding zero to any number returns the same number', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n + 0 === n;
      })
    );
  });

  it('string concatenation length equals sum of individual lengths', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (str1, str2) => {
        return (str1 + str2).length === str1.length + str2.length;
      })
    );
  });
});
