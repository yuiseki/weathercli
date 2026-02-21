import { expect, test } from 'vitest';
import { parseCoordinateOption, parsePositiveIntegerOption } from '../src/index';

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
