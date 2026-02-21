# ADR 002: Cache Strategy and Storage Layout

## Status
Accepted

## Context
Weather data is fetched from remote APIs. Repeated runs should avoid unnecessary network calls but still allow forced refresh.

## Decision
Use an XDG-style local cache with TTL-based freshness and per-location cache keys.

### 1. Cache root
- If `WEATHERCLI_CACHE_DIR` is set:
  - `<WEATHERCLI_CACHE_DIR>`
- Else if `XDG_CACHE_HOME` is set:
  - `<XDG_CACHE_HOME>/weathercli`
- Otherwise:
  - `~/.cache/weathercli`

### 2. Cache file layout
- Path: `<cache-root>/<cache-key>.json`
- Example keys:
  - `current` (IP-based location)
  - `tokyo` (preset city)
  - `lat_35_7126_lon_139_7799` (coordinate query)

### 3. Freshness rules
- Default TTL is 30 minutes.
- `weather list` reads cache when still fresh.
- `weather list --sync` and `weather sync` bypass cache and always rewrite it.

## Consequences
- Fast repeated reads in normal usage.
- Explicit freshness control for automation and scheduled jobs.
- Cache is independent of repository working tree state.
