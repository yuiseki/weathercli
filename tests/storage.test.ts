import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, expect, test } from 'vitest';
import {
  formatDateKey,
  getCachePath,
  isCacheFresh,
  loadCache,
  parseDateKey,
  sanitizePathSegment,
  saveCache,
} from '../src/storage';
import { type LocationHierarchy, type WeatherCache } from '../src/types';

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'weathercli-test-'));
  tempRoots.push(root);
  return root;
}

function sampleHierarchy(): LocationHierarchy {
  return {
    country: 'Japan',
    state: 'Tokyo',
    locality: 'Taito',
    source: 'nominatim',
    raw: {
      countryCode: 'JP',
      iso3166Level4: 'JP-13',
    },
  };
}

function sampleCache(updatedAt: string, dateKey: string): WeatherCache {
  return {
    version: 2,
    dateKey,
    locationPath: sampleHierarchy(),
    snapshot: {
      updatedAt,
      dateKey,
      hierarchy: sampleHierarchy(),
      location: {
        name: 'Tokyo',
        latitude: 35.6895,
        longitude: 139.6917,
        source: 'preset',
        presetKey: 'tokyo',
      },
      current: {
        observedAt: updatedAt,
        temperatureC: 12.3,
        windSpeedKmh: 4.5,
        windDirectionDegrees: 120,
        weatherCode: 1,
        weatherLabel: 'Mainly clear',
      },
      forecast: [
        {
          date: '2026-02-21',
          temperatureMaxC: 13.3,
          temperatureMinC: 1.4,
          weatherCode: 1,
          weatherLabel: 'Mainly clear',
        },
      ],
    },
  };
}

test('formatDateKey formats YYYY-MM-DD', () => {
  expect(formatDateKey(new Date(2026, 1, 21))).toBe('2026-02-21');
});

test('parseDateKey validates yyyy-mm-dd', () => {
  expect(parseDateKey('2026-02-21')).toEqual({ year: '2026', month: '02', day: '21' });
  expect(() => parseDateKey('2026-02')).toThrow('dateKey must be yyyy-mm-dd.');
  expect(() => parseDateKey('2026-02-30')).toThrow('dateKey must be a valid calendar date.');
});

test('sanitizePathSegment normalizes labels', () => {
  expect(sanitizePathSegment('Tokyo Prefecture')).toBe('tokyo-prefecture');
  expect(sanitizePathSegment(' Taito Ward ')).toBe('taito-ward');
});

test('getCachePath builds date and hierarchy directories', () => {
  const cachePath = getCachePath('/tmp/weather', '2026-02-21', sampleHierarchy());
  expect(cachePath).toBe('/tmp/weather/2026/02/21/japan/tokyo/taito/data.json');
});

test('saveCache and loadCache round-trip valid payload', () => {
  const tempRoot = createTempRoot();
  const cache = sampleCache('2026-02-21T00:00:00.000Z', '2026-02-21');
  const hierarchy = sampleHierarchy();

  saveCache(tempRoot, cache.dateKey, hierarchy, cache);

  const loaded = loadCache(tempRoot, cache.dateKey, hierarchy);
  expect(loaded).toEqual(cache);
});

test('loadCache returns null for invalid JSON payload', () => {
  const tempRoot = createTempRoot();
  const hierarchy = sampleHierarchy();
  const cachePath = getCachePath(tempRoot, '2026-02-21', hierarchy);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, '{"invalid":true}', 'utf8');

  expect(loadCache(tempRoot, '2026-02-21', hierarchy)).toBeNull();
});

test('isCacheFresh checks ttl with snapshot updatedAt', () => {
  const cache = sampleCache('2026-02-21T00:00:00.000Z', '2026-02-21');
  const now = new Date('2026-02-21T00:20:00.000Z').getTime();

  expect(isCacheFresh(cache, 30, now)).toBe(true);
  expect(isCacheFresh(cache, 10, now)).toBe(false);
});
