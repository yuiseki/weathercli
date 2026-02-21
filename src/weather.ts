import {
  detectLocationByIP,
  fetchWeatherByCoordinates,
  reverseGeocodeByCoordinates,
  type NominatimAddress,
  type OpenMeteoWeatherResponse,
} from './api';
import {
  describeHierarchyPath,
  formatDateKey,
  getCacheDir,
  isCacheFresh,
  loadCache,
  saveCache,
} from './storage';
import {
  type ForecastDay,
  type LocationHierarchy,
  type PresetCityKey,
  type ResolvedLocation,
  type WeatherCache,
  type WeatherSnapshot,
} from './types';

export const PRESET_CITIES: Record<PresetCityKey, { name: string; latitude: number; longitude: number }> = {
  tokyo: { name: 'Tokyo', latitude: 35.6895, longitude: 139.6917 },
  osaka: { name: 'Osaka', latitude: 34.6937, longitude: 135.5023 },
  nagoya: { name: 'Nagoya', latitude: 35.1815, longitude: 136.9066 },
  sapporo: { name: 'Sapporo', latitude: 43.0611, longitude: 141.3564 },
  fukuoka: { name: 'Fukuoka', latitude: 33.5904, longitude: 130.4017 },
};

const JAPAN_PREFECTURE_BY_ISO3166_LEVEL4: Record<string, string> = {
  'JP-01': 'hokkaido',
  'JP-02': 'aomori',
  'JP-03': 'iwate',
  'JP-04': 'miyagi',
  'JP-05': 'akita',
  'JP-06': 'yamagata',
  'JP-07': 'fukushima',
  'JP-08': 'ibaraki',
  'JP-09': 'tochigi',
  'JP-10': 'gunma',
  'JP-11': 'saitama',
  'JP-12': 'chiba',
  'JP-13': 'tokyo',
  'JP-14': 'kanagawa',
  'JP-15': 'niigata',
  'JP-16': 'toyama',
  'JP-17': 'ishikawa',
  'JP-18': 'fukui',
  'JP-19': 'yamanashi',
  'JP-20': 'nagano',
  'JP-21': 'gifu',
  'JP-22': 'shizuoka',
  'JP-23': 'aichi',
  'JP-24': 'mie',
  'JP-25': 'shiga',
  'JP-26': 'kyoto',
  'JP-27': 'osaka',
  'JP-28': 'hyogo',
  'JP-29': 'nara',
  'JP-30': 'wakayama',
  'JP-31': 'tottori',
  'JP-32': 'shimane',
  'JP-33': 'okayama',
  'JP-34': 'hiroshima',
  'JP-35': 'yamaguchi',
  'JP-36': 'tokushima',
  'JP-37': 'kagawa',
  'JP-38': 'ehime',
  'JP-39': 'kochi',
  'JP-40': 'fukuoka',
  'JP-41': 'saga',
  'JP-42': 'nagasaki',
  'JP-43': 'kumamoto',
  'JP-44': 'oita',
  'JP-45': 'miyazaki',
  'JP-46': 'kagoshima',
  'JP-47': 'okinawa',
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
  dateKey?: string;
  forceSync?: boolean;
  now?: Date;
};

export type LoadedWeather = {
  fromCache: boolean;
  dateKey: string;
  hierarchyPath: string;
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

function normalizeAdminSegment(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .replace(/\b(prefecture|metropolis|province|state|region|county)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || undefined;
}

function normalizeLocalitySegment(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const normalized = value
    .replace(/\b(ward|city|district|municipality|county)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || undefined;
}

function pickAddressValue(address: NominatimAddress | undefined, keys: string[]): string | undefined {
  if (!address) return undefined;

  for (const key of keys) {
    const value = address[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function fallbackHierarchy(location: ResolvedLocation): LocationHierarchy {
  const preset = location.presetKey ? PRESET_CITIES[location.presetKey] : undefined;

  return {
    country: 'unknown',
    state: preset?.name || 'unknown',
    locality: preset?.name || 'unknown',
    source: 'fallback',
    raw: {},
  };
}

function hierarchyFromNominatimAddress(
  address: NominatimAddress,
  location: ResolvedLocation,
): LocationHierarchy {
  const countryCode = address.country_code?.toUpperCase();
  const iso3166Level4 = address['ISO3166-2-lvl4'];

  let state = normalizeAdminSegment(
    pickAddressValue(address, ['province', 'state', 'state_district', 'region', 'county']),
  );

  if (!state && countryCode === 'JP' && iso3166Level4) {
    state = JAPAN_PREFECTURE_BY_ISO3166_LEVEL4[iso3166Level4];
  }

  const locality = normalizeLocalitySegment(
    pickAddressValue(address, [
      'city',
      'town',
      'municipality',
      'borough',
      'suburb',
      'quarter',
      'village',
      'hamlet',
      'county',
    ]),
  );

  const fallback = fallbackHierarchy(location);

  return {
    country: address.country || (countryCode === 'JP' ? 'Japan' : countryCode?.toLowerCase()) || fallback.country,
    state: state || fallback.state,
    locality: locality || fallback.locality,
    source: 'nominatim',
    raw: {
      countryCode,
      iso3166Level4,
    },
  };
}

async function resolveLocationHierarchy(location: ResolvedLocation): Promise<LocationHierarchy> {
  try {
    const reverse = await reverseGeocodeByCoordinates(location.latitude, location.longitude);
    if (reverse.address) {
      return hierarchyFromNominatimAddress(reverse.address, location);
    }
  } catch (_error) {
    // fallback below
  }

  return fallbackHierarchy(location);
}

function buildSnapshot(
  location: ResolvedLocation,
  hierarchy: LocationHierarchy,
  dateKey: string,
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
    dateKey,
    location,
    hierarchy,
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
  const now = options.now || new Date();
  const nowMs = now.getTime();
  const todayDateKey = formatDateKey(now);
  const dateKey = options.dateKey || todayDateKey;
  const isToday = dateKey === todayDateKey;

  if (options.forceSync && !isToday) {
    throw new Error('--sync is only supported for today.');
  }

  const cacheRoot = getCacheDir(options.cacheDir);
  const location = await resolveLocation(options.request);
  const hierarchy = await resolveLocationHierarchy(location);
  const hierarchyPath = describeHierarchyPath(hierarchy);
  const cached = loadCache(cacheRoot, dateKey, hierarchy);

  if (!isToday) {
    if (!cached) {
      throw new Error(`No cache snapshot for ${dateKey} (${hierarchyPath}).`);
    }

    return {
      fromCache: true,
      dateKey,
      hierarchyPath,
      snapshot: cached.snapshot,
    };
  }

  if (!options.forceSync && cached && isCacheFresh(cached, options.cacheTtlMinutes, nowMs)) {
    return {
      fromCache: true,
      dateKey,
      hierarchyPath,
      snapshot: cached.snapshot,
    };
  }

  const apiResponse = await fetchWeatherByCoordinates(location.latitude, location.longitude);
  const snapshot = buildSnapshot(location, hierarchy, dateKey, apiResponse, now);

  const cachePayload: WeatherCache = {
    version: 2,
    dateKey,
    locationPath: hierarchy,
    snapshot,
  };
  saveCache(cacheRoot, dateKey, hierarchy, cachePayload);

  return {
    fromCache: false,
    dateKey,
    hierarchyPath,
    snapshot,
  };
}

export function formatWeatherReport(loaded: LoadedWeather): string {
  const modeLabel = loaded.fromCache ? 'Cache' : 'Fresh';
  const snapshot = loaded.snapshot;
  const lines: string[] = [];

  lines.push(`weather (${modeLabel})`);
  lines.push(`Date: ${loaded.dateKey}`);
  lines.push(`Location: ${snapshot.location.name}`);
  lines.push(
    `Coordinates: ${snapshot.location.latitude.toFixed(4)}, ${snapshot.location.longitude.toFixed(4)}`,
  );
  lines.push(`Cache path: ${loaded.hierarchyPath}`);
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
