import { expect, test } from 'vitest';
import {
  buildCacheKey,
  resolveLocationRequest,
  resolvePresetCityKey,
  weatherCodeToLabel,
} from '../src/weather';

test('resolvePresetCityKey supports English and Japanese names', () => {
  expect(resolvePresetCityKey('tokyo')).toBe('tokyo');
  expect(resolvePresetCityKey('東京')).toBe('tokyo');
  expect(resolvePresetCityKey('大阪')).toBe('osaka');
});

test('resolveLocationRequest returns ip when no location options are provided', () => {
  expect(resolveLocationRequest({})).toEqual({ type: 'ip' });
});

test('resolveLocationRequest resolves preset city by --city', () => {
  expect(resolveLocationRequest({ city: 'fukuoka' })).toEqual({
    type: 'preset',
    cityKey: 'fukuoka',
  });
});

test('resolveLocationRequest resolves preset city by shortcut flag', () => {
  expect(resolveLocationRequest({ osaka: true })).toEqual({
    type: 'preset',
    cityKey: 'osaka',
  });
});

test('resolveLocationRequest resolves coordinates', () => {
  expect(resolveLocationRequest({ latitude: 35.7, longitude: 139.7 })).toEqual({
    type: 'coordinates',
    latitude: 35.7,
    longitude: 139.7,
  });
});

test('resolveLocationRequest rejects incompatible location flags', () => {
  expect(() => resolveLocationRequest({ latitude: 35.7 })).toThrow(
    '--lat and --lon must be provided together.',
  );
  expect(() => resolveLocationRequest({ city: 'tokyo', osaka: true })).toThrow(
    '--city cannot be combined with preset city shortcuts.',
  );
  expect(() => resolveLocationRequest({ latitude: 35.7, longitude: 139.7, city: 'tokyo' })).toThrow(
    '--lat/--lon cannot be combined with --city or preset city shortcuts.',
  );
});

test('resolveLocationRequest rejects unsupported city names', () => {
  expect(() => resolveLocationRequest({ city: 'kyoto' })).toThrow(
    '--city must be one of: tokyo, osaka, nagoya, sapporo, fukuoka',
  );
});

test('buildCacheKey returns stable keys by request type', () => {
  expect(buildCacheKey({ type: 'ip' })).toBe('current');
  expect(buildCacheKey({ type: 'preset', cityKey: 'nagoya' })).toBe('nagoya');
  expect(
    buildCacheKey({ type: 'coordinates', latitude: 35.7126, longitude: 139.7799 }),
  ).toBe('lat_35_7126_lon_139_7799');
});

test('weatherCodeToLabel resolves known and unknown codes', () => {
  expect(weatherCodeToLabel(0)).toBe('Clear sky');
  expect(weatherCodeToLabel(999)).toBe('Unknown');
});
