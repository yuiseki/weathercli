import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { z } from 'zod';

dotenv.config({ quiet: true });

export type WeatherCliConfig = {
  WEATHERCLI_CACHE_DIR: string;
  WEATHERCLI_CACHE_TTL_MINUTES: number;
};

const envSchema = z.object({
  WEATHERCLI_CACHE_DIR: z.string().optional(),
  WEATHERCLI_CACHE_TTL_MINUTES: z.string().optional(),
});

function defaultCacheDir(): string {
  const cacheBase = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(cacheBase, 'weathercli');
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;

  return parsed;
}

function loadConfigFromEnv(): WeatherCliConfig {
  const parsed = envSchema.parse({
    WEATHERCLI_CACHE_DIR: process.env.WEATHERCLI_CACHE_DIR,
    WEATHERCLI_CACHE_TTL_MINUTES: process.env.WEATHERCLI_CACHE_TTL_MINUTES,
  });

  return {
    WEATHERCLI_CACHE_DIR: parsed.WEATHERCLI_CACHE_DIR
      ? path.resolve(parsed.WEATHERCLI_CACHE_DIR)
      : defaultCacheDir(),
    WEATHERCLI_CACHE_TTL_MINUTES: parsePositiveInteger(parsed.WEATHERCLI_CACHE_TTL_MINUTES, 30),
  };
}

export let config = loadConfigFromEnv();

export function setConfigOverrides(overrides: Partial<WeatherCliConfig>): void {
  config = {
    ...config,
    ...overrides,
  };
}
