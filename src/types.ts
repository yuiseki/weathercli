export type PresetCityKey = 'tokyo' | 'osaka' | 'nagoya' | 'sapporo' | 'fukuoka';

export type LocationSource = 'preset' | 'coordinates' | 'ip' | 'ip-fallback';

export type ResolvedLocation = {
  name: string;
  latitude: number;
  longitude: number;
  source: LocationSource;
  presetKey?: PresetCityKey;
};

export type CurrentWeather = {
  observedAt: string;
  temperatureC: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  weatherCode: number;
  weatherLabel: string;
};

export type ForecastDay = {
  date: string;
  temperatureMaxC: number;
  temperatureMinC: number;
  weatherCode: number;
  weatherLabel: string;
};

export type WeatherSnapshot = {
  updatedAt: string;
  location: ResolvedLocation;
  current: CurrentWeather;
  forecast: ForecastDay[];
};

export type WeatherCache = {
  version: 1;
  cacheKey: string;
  snapshot: WeatherSnapshot;
};
