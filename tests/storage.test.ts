import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, expect, test } from 'vitest';
import { getCachePath, isCacheFresh, loadCache, saveCache, sanitizeCacheKey } from '../src/storage';
import { type WeatherCache } from '../src/types';

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

function sampleCache(updatedAt: string): WeatherCache {
  return {
    version: 1,
    cacheKey: 'tokyo',
    snapshot: {
      updatedAt,
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

test('sanitizeCacheKey normalizes unsupported characters', () => {
  expect(sanitizeCacheKey('Lat 35.7/Lon 139.7')).toBe('lat_35.7_lon_139.7');
});

test('saveCache and loadCache round-trip valid payload', () => {
  const tempRoot = createTempRoot();
  const cache = sampleCache('2026-02-21T00:00:00.000Z');

  saveCache(tempRoot, cache.cacheKey, cache);

  const loaded = loadCache(tempRoot, cache.cacheKey);
  expect(loaded).toEqual(cache);
});

test('loadCache returns null for invalid JSON payload', () => {
  const tempRoot = createTempRoot();
  const cachePath = getCachePath(tempRoot, 'broken');
  fs.writeFileSync(cachePath, '{"invalid":true}', 'utf8');

  expect(loadCache(tempRoot, 'broken')).toBeNull();
});

test('isCacheFresh checks ttl with snapshot updatedAt', () => {
  const cache = sampleCache('2026-02-21T00:00:00.000Z');
  const now = new Date('2026-02-21T00:20:00.000Z').getTime();

  expect(isCacheFresh(cache, 30, now)).toBe(true);
  expect(isCacheFresh(cache, 10, now)).toBe(false);
});
