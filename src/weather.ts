import { detectLocationByIP, fetchWeatherByCoordinates, type OpenMeteoWeatherResponse } from './api';
import { getCacheDir, isCacheFresh, loadCache, saveCache } from './storage';
import { type ForecastDay, type PresetCityKey, type ResolvedLocation, type WeatherCache, type WeatherSnapshot } from './types';

export const PRESET_CITIES: Record<PresetCityKey, { name: string; latitude: number; longitude: number }> = {
  tokyo: { name: 'Tokyo', latitude: 35.6895, longitude: 139.6917 },
  osaka: { name: 'Osaka', latitude: 34.6937, longitude: 135.5023 },
  nagoya: { name: 'Nagoya', latitude: 35.1815, longitude: 136.9066 },
  sapporo: { name: 'Sapporo', latitude: 43.0611, longitude: 141.3564 },
  fukuoka: { name: 'Fukuoka', latitude: 33.5904, longitude: 130.4017 },
};

export type LocationRequest =
  | { type: 'preset'; cityKey: PresetCityKey }
  | { type: 'coordinates'; latitude: number; longitude: number }
  | { type: 'ip' };

export type ResolveLocationInput = {
  city?: string;
  tokyo?: boolean;
  osaka?: boolean;
  nagoya?: boolean;
  sapporo?: boolean;
  fukuoka?: boolean;
  latitude?: number;
  longitude?: number;
};

export type LoadWeatherOptions = {
  request: LocationRequest;
  cacheDir: string;
  cacheTtlMinutes: number;
  forceSync?: boolean;
  now?: Date;
};

export type LoadedWeather = {
  fromCache: boolean;
  cacheKey: string;
  snapshot: WeatherSnapshot;
};

const CITY_ALIASES: Record<string, PresetCityKey> = {
  tokyo: 'tokyo',
  osaka: 'osaka',
  nagoya: 'nagoya',
  sapporo: 'sapporo',
  fukuoka: 'fukuoka',
  東京: 'tokyo',
  大阪: 'osaka',
  名古屋: 'nagoya',
  札幌: 'sapporo',
  福岡: 'fukuoka',
};

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function formatCoordinateForKey(value: number): string {
  const fixed = value.toFixed(4);
  return fixed.replace('-', 'm').replace('.', '_');
}

function formatCoordinateLabel(value: number): string {
  return value.toFixed(4);
}

function resolvePresetLocation(cityKey: PresetCityKey): ResolvedLocation {
  const preset = PRESET_CITIES[cityKey];
  return {
    name: preset.name,
    latitude: preset.latitude,
    longitude: preset.longitude,
    source: 'preset',
    presetKey: cityKey,
  };
}

async function resolveLocation(request: LocationRequest): Promise<ResolvedLocation> {
  if (request.type === 'preset') {
    return resolvePresetLocation(request.cityKey);
  }

  if (request.type === 'coordinates') {
    return {
      name: `Lat ${formatCoordinateLabel(request.latitude)}, Lon ${formatCoordinateLabel(request.longitude)}`,
      latitude: request.latitude,
      longitude: request.longitude,
      source: 'coordinates',
    };
  }

  try {
    const detected = await detectLocationByIP();
    return {
      name: detected.name,
      latitude: detected.latitude,
      longitude: detected.longitude,
      source: 'ip',
    };
  } catch (_error) {
    const fallback = resolvePresetLocation('tokyo');
    return {
      ...fallback,
      source: 'ip-fallback',
      name: `${fallback.name} (Fallback)`,
    };
  }
}

export function resolvePresetCityKey(value: string): PresetCityKey | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.toLowerCase();
  return CITY_ALIASES[normalized] || CITY_ALIASES[trimmed];
}

export function resolveLocationRequest(input: ResolveLocationInput): LocationRequest {
  const hasLatitude = typeof input.latitude === 'number';
  const hasLongitude = typeof input.longitude === 'number';

  if (hasLatitude !== hasLongitude) {
    throw new Error('--lat and --lon must be provided together.');
  }

  const shortcutKeys: PresetCityKey[] = [];
  if (input.tokyo) shortcutKeys.push('tokyo');
  if (input.osaka) shortcutKeys.push('osaka');
  if (input.nagoya) shortcutKeys.push('nagoya');
  if (input.sapporo) shortcutKeys.push('sapporo');
  if (input.fukuoka) shortcutKeys.push('fukuoka');

  if (shortcutKeys.length > 1) {
    throw new Error('Only one preset city shortcut can be used at a time.');
  }

  if (hasLatitude && (input.city || shortcutKeys.length > 0)) {
    throw new Error('--lat/--lon cannot be combined with --city or preset city shortcuts.');
  }

  if (hasLatitude) {
    return {
      type: 'coordinates',
      latitude: input.latitude as number,
      longitude: input.longitude as number,
    };
  }

  if (input.city && shortcutKeys.length > 0) {
    throw new Error('--city cannot be combined with preset city shortcuts.');
  }

  if (input.city) {
    const cityKey = resolvePresetCityKey(input.city);
    if (!cityKey) {
      const supported = Object.keys(PRESET_CITIES).join(', ');
      throw new Error(`--city must be one of: ${supported}`);
    }

    return {
      type: 'preset',
      cityKey,
    };
  }

  if (shortcutKeys.length === 1) {
    return {
      type: 'preset',
      cityKey: shortcutKeys[0],
    };
  }

  return { type: 'ip' };
}

export function buildCacheKey(request: LocationRequest): string {
  if (request.type === 'ip') return 'current';
  if (request.type === 'preset') return request.cityKey;

  return `lat_${formatCoordinateForKey(request.latitude)}_lon_${formatCoordinateForKey(request.longitude)}`;
}

export function weatherCodeToLabel(code: number): string {
  return WEATHER_CODE_LABELS[code] || 'Unknown';
}

function toForecastDays(apiResponse: OpenMeteoWeatherResponse, limit: number = 3): ForecastDay[] {
  const daily = apiResponse.daily;
  const size = Math.min(
    limit,
    daily.time.length,
    daily.temperature_2m_max.length,
    daily.temperature_2m_min.length,
    daily.weathercode.length,
  );

  const forecast: ForecastDay[] = [];
  for (let index = 0; index < size; index += 1) {
    const date = daily.time[index];
    const max = daily.temperature_2m_max[index];
    const min = daily.temperature_2m_min[index];
    const code = daily.weathercode[index];

    if (
      typeof date !== 'string' ||
      typeof max !== 'number' ||
      !Number.isFinite(max) ||
      typeof min !== 'number' ||
      !Number.isFinite(min) ||
      typeof code !== 'number' ||
      !Number.isFinite(code)
    ) {
      continue;
    }

    forecast.push({
      date,
      temperatureMaxC: max,
      temperatureMinC: min,
      weatherCode: code,
      weatherLabel: weatherCodeToLabel(code),
    });
  }

  return forecast;
}

function buildSnapshot(
  location: ResolvedLocation,
  apiResponse: OpenMeteoWeatherResponse,
  now: Date = new Date(),
): WeatherSnapshot {
  const current = apiResponse.current_weather;

  if (
    typeof current.temperature !== 'number' ||
    !Number.isFinite(current.temperature) ||
    typeof current.windspeed !== 'number' ||
    !Number.isFinite(current.windspeed) ||
    typeof current.winddirection !== 'number' ||
    !Number.isFinite(current.winddirection) ||
    typeof current.weathercode !== 'number' ||
    !Number.isFinite(current.weathercode)
  ) {
    throw new Error('Open-Meteo response contains invalid current weather fields.');
  }

  const forecast = toForecastDays(apiResponse, 3);
  if (forecast.length === 0) {
    throw new Error('Open-Meteo response does not contain daily forecast data.');
  }

  return {
    updatedAt: now.toISOString(),
    location,
    current: {
      observedAt: current.time,
      temperatureC: current.temperature,
      windSpeedKmh: current.windspeed,
      windDirectionDegrees: current.winddirection,
      weatherCode: current.weathercode,
      weatherLabel: weatherCodeToLabel(current.weathercode),
    },
    forecast,
  };
}

function formatTemperature(value: number): string {
  return `${value.toFixed(1)}°C`;
}

function formatWindSpeed(value: number): string {
  return `${value.toFixed(1)} km/h`;
}

export async function loadWeather(options: LoadWeatherOptions): Promise<LoadedWeather> {
  const cacheRoot = getCacheDir(options.cacheDir);
  const cacheKey = buildCacheKey(options.request);
  const nowMs = (options.now || new Date()).getTime();

  if (!options.forceSync) {
    const cached = loadCache(cacheRoot, cacheKey);
    if (cached && isCacheFresh(cached, options.cacheTtlMinutes, nowMs)) {
      return {
        fromCache: true,
        cacheKey,
        snapshot: cached.snapshot,
      };
    }
  }

  const location = await resolveLocation(options.request);
  const apiResponse = await fetchWeatherByCoordinates(location.latitude, location.longitude);
  const snapshot = buildSnapshot(location, apiResponse, options.now || new Date());

  const cachePayload: WeatherCache = {
    version: 1,
    cacheKey,
    snapshot,
  };
  saveCache(cacheRoot, cacheKey, cachePayload);

  return {
    fromCache: false,
    cacheKey,
    snapshot,
  };
}

export function formatWeatherReport(loaded: LoadedWeather): string {
  const modeLabel = loaded.fromCache ? 'Cache' : 'Fresh';
  const snapshot = loaded.snapshot;
  const lines: string[] = [];

  lines.push(`weather (${modeLabel})`);
  lines.push(`Location: ${snapshot.location.name}`);
  lines.push(
    `Coordinates: ${snapshot.location.latitude.toFixed(4)}, ${snapshot.location.longitude.toFixed(4)}`,
  );
  lines.push(`Updated: ${snapshot.updatedAt}`);
  lines.push(`Current: ${formatTemperature(snapshot.current.temperatureC)}, ${snapshot.current.weatherLabel}`);
  lines.push(`Wind: ${formatWindSpeed(snapshot.current.windSpeedKmh)}`);
  lines.push('');
  lines.push('3-Day Forecast:');

  for (const day of snapshot.forecast.slice(0, 3)) {
    lines.push(
      `- ${day.date}: ${formatTemperature(day.temperatureMaxC)} / ${formatTemperature(day.temperatureMinC)} - ${day.weatherLabel}`,
    );
  }

  return lines.join('\n');
}
