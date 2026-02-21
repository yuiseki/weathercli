# Weather Data Sources

## Open-Meteo Forecast API

- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Required query parameters:
  - `latitude`
  - `longitude`
  - `current_weather=true`
  - `daily=temperature_2m_max,temperature_2m_min,weathercode`
  - `timezone=auto`
  - `forecast_days=3`

The CLI uses this API for current conditions and daily forecast.

## IP Location API

- Endpoint: `http://ip-api.com/json/`

When no city or coordinates are specified, this API is used to detect current location. If IP detection fails, the CLI falls back to Tokyo.

## Reverse Geocoding API

- Endpoint: `https://nominatim.yuiseki.net/reverse`
- Parameters:
  - `format=jsonv2`
  - `lat`
  - `lon`
  - `addressdetails=1`
  - `zoom=18`
  - `accept-language=en`

The reverse geocoder result is used to generate cache hierarchy paths such as `japan/tokyo/taito`.
