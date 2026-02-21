# ADR 002: Cache Strategy and Storage Layout

## Status
Accepted

## Context
Weather data is fetched from remote APIs. We want daily logs that can be read later with `weather --date`, without calling Open-Meteo for past dates.

## Decision
Use date-partitioned cache plus geo hierarchy from reverse geocoding.

### 1. Cache root
- If `WEATHERCLI_CACHE_DIR` is set:
  - `<WEATHERCLI_CACHE_DIR>`
- Else if `XDG_CACHE_HOME` is set:
  - `<XDG_CACHE_HOME>/weathercli`
- Otherwise:
  - `~/.cache/weathercli`

### 2. Cache file layout
- Path: `<cache-root>/YYYY/MM/DD/<country>/<state>/<locality>/data.json`
- Example:
  - `~/.cache/weathercli/2026/02/21/japan/tokyo/taito/data.json`

Hierarchy is generated from coordinates using `nominatim.yuiseki.net` reverse geocoding.

### 3. Runtime rules
- `weather` default target date is today.
- `weather --date YYYY-MM-DD`:
  - if date is today: cache-first with TTL (network fetch allowed)
  - if date is in the past: cache-only (network fetch is not performed)
- `weather --sync` / `weather sync`:
  - today only
  - always bypasses cache and writes fresh snapshot

### 4. Freshness rules
- Default TTL is 30 minutes for today's snapshot.
- Past snapshots are immutable logs and are read as-is.

## Consequences
- Daily execution naturally accumulates history.
- Past-date reads are stable and deterministic.
- Cache lookup remains location-specific by geographic hierarchy.
