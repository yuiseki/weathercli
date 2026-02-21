import axios from 'axios';

export type IpDetectedLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

type IpApiResponse = {
  status?: string;
  city?: string;
  lat?: number;
  lon?: number;
  message?: string;
};

export type OpenMeteoWeatherResponse = {
  current_weather: {
    time: string;
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weathercode: number[];
  };
};

export type NominatimAddress = {
  country?: string;
  country_code?: string;
  city?: string;
  town?: string;
  municipality?: string;
  village?: string;
  suburb?: string;
  borough?: string;
  quarter?: string;
  county?: string;
  state?: string;
  province?: string;
  region?: string;
  state_district?: string;
  [key: string]: string | undefined;
};

export type NominatimReverseResponse = {
  address?: NominatimAddress;
};

export async function detectLocationByIP(): Promise<IpDetectedLocation> {
  const response = await axios.get<IpApiResponse>('http://ip-api.com/json/', {
    timeout: 10_000,
  });

  const payload = response.data;
  if (payload.status === 'fail') {
    throw new Error(`IP detection failed: ${payload.message || 'unknown reason'}`);
  }

  if (
    typeof payload.lat !== 'number' ||
    !Number.isFinite(payload.lat) ||
    typeof payload.lon !== 'number' ||
    !Number.isFinite(payload.lon)
  ) {
    throw new Error('IP detection failed: invalid latitude/longitude in response.');
  }

  return {
    name: payload.city?.trim() ? `${payload.city.trim()} (Detected)` : 'Detected location',
    latitude: payload.lat,
    longitude: payload.lon,
  };
}

export async function fetchWeatherByCoordinates(
  latitude: number,
  longitude: number,
): Promise<OpenMeteoWeatherResponse> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    daily: 'temperature_2m_max,temperature_2m_min,weathercode',
    timezone: 'auto',
    forecast_days: '3',
  });

  const url = `https://api.open-meteo.com/v1/forecast?${query.toString()}`;
  const response = await axios.get<OpenMeteoWeatherResponse>(url, {
    timeout: 10_000,
  });

  const payload = response.data;
  if (!payload.current_weather || !payload.daily) {
    throw new Error('Open-Meteo response is missing required fields.');
  }

  return payload;
}

export async function reverseGeocodeByCoordinates(
  latitude: number,
  longitude: number,
): Promise<NominatimReverseResponse> {
  const response = await axios.get<NominatimReverseResponse>(
    'https://nominatim.yuiseki.net/reverse',
    {
      params: {
        format: 'jsonv2',
        lat: latitude,
        lon: longitude,
        addressdetails: 1,
        zoom: 18,
        'accept-language': 'en',
      },
      timeout: 10_000,
    },
  );

  const payload = response.data;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Nominatim response is invalid.');
  }

  return payload;
}
