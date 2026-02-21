import fs from 'fs';
import path from 'path';
import { type ForecastDay, type LocationHierarchy, type WeatherCache, type WeatherSnapshot } from './types';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getCacheDir(baseDir: string): string {
  ensureDirectory(baseDir);
  return baseDir;
}

export function formatDateKey(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): { year: string; month: string; day: string } {
  const match = dateKey.match(DATE_KEY_PATTERN);
  if (!match) {
    throw new Error('dateKey must be yyyy-mm-dd.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(year, month - 1, day);

  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    throw new Error('dateKey must be a valid calendar date.');
  }

  return {
    year: match[1],
    month: match[2],
    day: match[3],
  };
}

export function sanitizePathSegment(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'unknown';
}

export function getCachePath(
  cacheDir: string,
  dateKey: string,
  hierarchy: LocationHierarchy,
): string {
  const parts = parseDateKey(dateKey);
  return path.join(
    cacheDir,
    parts.year,
    parts.month,
    parts.day,
    sanitizePathSegment(hierarchy.country),
    sanitizePathSegment(hierarchy.state),
    sanitizePathSegment(hierarchy.locality),
    'data.json',
  );
}

export function describeHierarchyPath(hierarchy: LocationHierarchy): string {
  return [hierarchy.country, hierarchy.state, hierarchy.locality]
    .map((segment) => sanitizePathSegment(segment))
    .join('/');
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
  if (!record.hierarchy || typeof record.hierarchy !== 'object') return false;

  const location = record.location as Record<string, unknown>;
  const current = record.current as Record<string, unknown>;
  const hierarchy = record.hierarchy as Record<string, unknown>;

  return (
    typeof record.updatedAt === 'string' &&
    typeof record.dateKey === 'string' &&
    typeof location.name === 'string' &&
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude) &&
    typeof location.source === 'string' &&
    typeof hierarchy.country === 'string' &&
    typeof hierarchy.state === 'string' &&
    typeof hierarchy.locality === 'string' &&
    typeof hierarchy.source === 'string' &&
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

  if (!record.locationPath || typeof record.locationPath !== 'object') return false;
  const locationPath = record.locationPath as Record<string, unknown>;

  return (
    record.version === 2 &&
    typeof record.dateKey === 'string' &&
    typeof locationPath.country === 'string' &&
    typeof locationPath.state === 'string' &&
    typeof locationPath.locality === 'string' &&
    isWeatherSnapshot(record.snapshot)
  );
}

export function loadCache(
  cacheDir: string,
  dateKey: string,
  hierarchy: LocationHierarchy,
): WeatherCache | null {
  const cachePath = getCachePath(cacheDir, dateKey, hierarchy);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as unknown;
    if (!isWeatherCache(parsed)) return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function saveCache(
  cacheDir: string,
  dateKey: string,
  hierarchy: LocationHierarchy,
  cache: WeatherCache,
): void {
  const cachePath = getCachePath(cacheDir, dateKey, hierarchy);
  ensureDirectory(path.dirname(cachePath));
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

export function isCacheFresh(cache: WeatherCache, ttlMinutes: number, nowMs: number = Date.now()): boolean {
  const updatedAtMs = new Date(cache.snapshot.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return false;

  const ttlMs = ttlMinutes * 60 * 1000;
  return nowMs - updatedAtMs < ttlMs;
}
