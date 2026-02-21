import fs from 'fs';
import path from 'path';
import { type ForecastDay, type WeatherCache, type WeatherSnapshot } from './types';

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getCacheDir(baseDir: string): string {
  ensureDirectory(baseDir);
  return baseDir;
}

export function sanitizeCacheKey(value: string): string {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  if (!sanitized) {
    throw new Error('cache key must not be empty.');
  }
  return sanitized;
}

export function getCachePath(cacheDir: string, cacheKey: string): string {
  return path.join(cacheDir, `${sanitizeCacheKey(cacheKey)}.json`);
}

function isForecastDay(value: unknown): value is ForecastDay {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.date === 'string' &&
    typeof record.temperatureMaxC === 'number' &&
    Number.isFinite(record.temperatureMaxC) &&
    typeof record.temperatureMinC === 'number' &&
    Number.isFinite(record.temperatureMinC) &&
    typeof record.weatherCode === 'number' &&
    Number.isFinite(record.weatherCode) &&
    typeof record.weatherLabel === 'string'
  );
}

function isWeatherSnapshot(value: unknown): value is WeatherSnapshot {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  if (!record.location || typeof record.location !== 'object') return false;
  if (!record.current || typeof record.current !== 'object') return false;

  const location = record.location as Record<string, unknown>;
  const current = record.current as Record<string, unknown>;

  return (
    typeof record.updatedAt === 'string' &&
    typeof location.name === 'string' &&
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    typeof location.source === 'string' &&
    typeof current.observedAt === 'string' &&
    typeof current.temperatureC === 'number' &&
    Number.isFinite(current.temperatureC) &&
    typeof current.windSpeedKmh === 'number' &&
    Number.isFinite(current.windSpeedKmh) &&
    typeof current.windDirectionDegrees === 'number' &&
    Number.isFinite(current.windDirectionDegrees) &&
    typeof current.weatherCode === 'number' &&
    Number.isFinite(current.weatherCode) &&
    typeof current.weatherLabel === 'string' &&
    Array.isArray(record.forecast) &&
    record.forecast.every((item) => isForecastDay(item))
  );
}

function isWeatherCache(value: unknown): value is WeatherCache {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;

  return (
    record.version === 1 &&
    typeof record.cacheKey === 'string' &&
    isWeatherSnapshot(record.snapshot)
  );
}

export function loadCache(cacheDir: string, cacheKey: string): WeatherCache | null {
  const cachePath = getCachePath(cacheDir, cacheKey);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as unknown;
    if (!isWeatherCache(parsed)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function saveCache(cacheDir: string, cacheKey: string, cache: WeatherCache): void {
  const cachePath = getCachePath(cacheDir, cacheKey);
  ensureDirectory(path.dirname(cachePath));
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

export function isCacheFresh(cache: WeatherCache, ttlMinutes: number, nowMs: number = Date.now()): boolean {
  const updatedAtMs = new Date(cache.snapshot.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;

  const ttlMs = ttlMinutes * 60 * 1000;
  return nowMs - updatedAtMs < ttlMs;
}
