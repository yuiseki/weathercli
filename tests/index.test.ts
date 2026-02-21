import { expect, test } from 'vitest';
import { parseCoordinateOption, parseDateOption, parsePositiveIntegerOption } from '../src/index';

test('parsePositiveIntegerOption parses valid integer', () => {
  expect(parsePositiveIntegerOption('30', '--cache-ttl-minutes')).toBe(30);
});

test('parsePositiveIntegerOption rejects non-positive or non-integer values', () => {
  expect(() => parsePositiveIntegerOption('0', '--cache-ttl-minutes')).toThrow(
    '--cache-ttl-minutes must be a positive integer.',
  );
  expect(() => parsePositiveIntegerOption('abc', '--cache-ttl-minutes')).toThrow(
    '--cache-ttl-minutes must be a positive integer.',
  );
});

test('parseCoordinateOption parses in-range coordinates', () => {
  expect(parseCoordinateOption('35.7126', '--lat', -90, 90)).toBeCloseTo(35.7126);
  expect(parseCoordinateOption('139.7799', '--lon', -180, 180)).toBeCloseTo(139.7799);
});

test('parseCoordinateOption rejects invalid coordinates', () => {
  expect(() => parseCoordinateOption('abc', '--lat', -90, 90)).toThrow(
    '--lat must be a valid number.',
  );
  expect(() => parseCoordinateOption('190', '--lon', -180, 180)).toThrow(
    '--lon must be between -180 and 180.',
  );
});

test('parseDateOption resolves today when omitted', () => {
  const parsed = parseDateOption(undefined, new Date(2026, 1, 21));
  expect(parsed).toEqual({ dateKey: '2026-02-21', isToday: true });
});

test('parseDateOption parses explicit date', () => {
  const parsed = parseDateOption('2026-02-20', new Date(2026, 1, 21));
  expect(parsed).toEqual({ dateKey: '2026-02-20', isToday: false });
});

test('parseDateOption rejects invalid formats and values', () => {
  expect(() => parseDateOption('2026-02', new Date(2026, 1, 21))).toThrow(
    '--date format must be yyyy-mm-dd.',
  );
  expect(() => parseDateOption('2026-02-30', new Date(2026, 1, 21))).toThrow(
    '--date must be a valid calendar date.',
  );
});
