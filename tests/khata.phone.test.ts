import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { normalizePhone, validatePakistaniPhone } from '@skeleton/core';

describe('Pakistani phone validation (TR-7)', () => {
  it.each(['03001234567', '0300-1234567', '0300 1234567', '03331234567', '0345 9876543', ' 03001234567 '.trim()])(
    'accepts %s',
    (phone) => {
      expect(validatePakistaniPhone(phone)).toBe(true);
    },
  );

  it.each([
    ['international without plus', '923001234567'],
    ['international with plus', '+923001234567'],
    ['international with plus and hyphens', '+92-300-1234567'],
    ['landline-style start 01', '01234567890'],
    ['landline with area code', '042-35761234'],
    ['too short (10 digits)', '0300123456'],
    ['too long (12 digits)', '030012345678'],
    ['does not start with 03', '04001234567'],
    ['empty string', ''],
    ['only spaces', '   '],
    ['letters', 'abcdefghijk'],
    ['digits with a letter', '0300123456a'],
    ['text with a dot', '0300.1234567'],
    ['brackets', '(0300)1234567'],
  ])('rejects %s (%s)', (_label, phone) => {
    expect(validatePakistaniPhone(phone)).toBe(false);
  });

  it('accepts numbers typed with an Urdu keyboard', () => {
    expect(validatePakistaniPhone('۰۳۰۰۱۲۳۴۵۶۷')).toBe(true);
    expect(validatePakistaniPhone('۰۳۰۰-۱۲۳۴۵۶۷')).toBe(true);
  });

  it('normalizes to the bare 11 digits', () => {
    expect(normalizePhone('0300-1234567')).toBe('03001234567');
    expect(normalizePhone('0300 1234567')).toBe('03001234567');
    expect(normalizePhone('۰۳۰۰۱۲۳۴۵۶۷')).toBe('03001234567');
  });

  it('property: validation never throws and only accepts strings that normalize to 03 + 9 digits', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 20 }), (input) => {
        const result = validatePakistaniPhone(input);
        expect(result).toBe(/^03\d{9}$/.test(normalizePhone(input)));
      }),
    );
  });
});
