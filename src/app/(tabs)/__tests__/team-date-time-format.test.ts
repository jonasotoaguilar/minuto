import {
  decimalToHHMM,
  formatDateForDisplay,
  formatDateForStorageFromPicker,
  formatDateInputOnBlur,
  formatTimeInputOnBlur,
  isValidStorageDateInput,
  normalizeDateForStorage,
  normalizeOptionalText,
  parseHHMMInput,
} from '@/components/team/team-date-time-format';

describe('decimalToHHMM', () => {
  it('formats decimal hours as HH:MM', () => {
    expect(decimalToHHMM(8)).toBe('08:00');
    expect(decimalToHHMM(0.75)).toBe('00:45');
    expect(decimalToHHMM(9.5)).toBe('09:30');
    expect(decimalToHHMM(-1)).toBe('00:00');
  });
});

describe('parseHHMMInput', () => {
  it('parses valid HH:MM values to decimal hours', () => {
    expect(parseHHMMInput('08:00')).toBe(8);
    expect(parseHHMMInput('00:45')).toBe(0.75);
    expect(parseHHMMInput('830')).toBe(8.5);
  });

  it('rejects invalid values', () => {
    expect(parseHHMMInput('')).toBeNull();
    expect(parseHHMMInput('abc')).toBeNull();
    expect(parseHHMMInput('25:00')).toBeNull();
    expect(parseHHMMInput('08:60')).toBeNull();
    expect(parseHHMMInput('24:01')).toBeNull();
  });
});

describe('formatTimeInputOnBlur', () => {
  it('pads compact digits and colon-separated input', () => {
    expect(formatTimeInputOnBlur('830')).toBe('08:30');
    expect(formatTimeInputOnBlur('8:3')).toBe('08:03');
    expect(formatTimeInputOnBlur('')).toBe('');
  });
});

describe('date helpers', () => {
  it('formats storage dates for display', () => {
    expect(formatDateForDisplay('2026-01-15')).toBe('15/01/2026');
    expect(formatDateForDisplay('invalid')).toBe('');
  });

  it('normalizes display input to storage dates', () => {
    expect(normalizeDateForStorage('15/01/2026')).toBe('2026-01-15');
    expect(normalizeDateForStorage('15012026')).toBe('2026-01-15');
    expect(normalizeDateForStorage('')).toBe('');
    expect(normalizeDateForStorage('31/02/2026')).toBeNull();
  });

  it('formats date input on blur', () => {
    expect(formatDateInputOnBlur('15012026')).toBe('15/01/2026');
    expect(formatDateInputOnBlur('1/2/2026')).toBe('01/02/2026');
  });

  it('round-trips picker dates through storage format', () => {
    const date = new Date(2026, 0, 15);
    const storage = formatDateForStorageFromPicker(date);
    expect(storage).toBe('2026-01-15');
    expect(isValidStorageDateInput(storage)).toBe(true);
    expect(isValidStorageDateInput('2026-13-01')).toBe(false);
  });
});

describe('normalizeOptionalText', () => {
  it('trims text and returns undefined for empty values', () => {
    expect(normalizeOptionalText('  Cargo  ')).toBe('Cargo');
    expect(normalizeOptionalText('   ')).toBeUndefined();
    expect(normalizeOptionalText('')).toBeUndefined();
  });
});
