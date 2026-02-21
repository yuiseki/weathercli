# @yuiseki/weathercli

Weather CLI for current conditions and 3-day forecast using Open-Meteo.

## Install

```bash
npm i -g @yuiseki/weathercli
```

Installed commands:

- `weather` (recommended)
- `weathercli` (compatibility alias)

## Usage

```bash
weather --help
```

### Main commands

- `weather` / `weather list` / `weather ls`: show current weather and 3-day forecast
- `weather sync`: bypass cache and refresh snapshot immediately

### Location selection

- Default: detect current location by IP
- Preset cities: `tokyo`, `osaka`, `nagoya`, `sapporo`, `fukuoka`
- Coordinates: `--lat <number> --lon <number>`

### Options

- `--sync`: force refresh when using `weather list`
- `-c, --city <name>`: preset city name
- `--tokyo`, `--osaka`, `--nagoya`, `--sapporo`, `--fukuoka`: preset shortcuts
- `--lat <number>` and `--lon <number>`: coordinate query
- `-j, --json`: JSON output
- `--cache-dir <path>`: override cache directory
- `--cache-ttl-minutes <minutes>`: cache TTL (default: `30`)

Examples:

```bash
weather
weather --city osaka
weather --tokyo
weather --lat 35.7126 --lon 139.7799 --json
weather --sync
weather sync --city fukuoka
```

## Cache

Default cache directory:

- `$XDG_CACHE_HOME/weathercli` if `XDG_CACHE_HOME` is set
- `~/.cache/weathercli` otherwise

Cache file layout:

- `<cache-root>/<cache-key>.json`
- `current` for IP-based queries
- `<city>` for preset cities (`tokyo`, `osaka`, etc.)
- `lat_<...>_lon_<...>` for coordinate queries

## Development

```bash
npm install
npm run build
npm test
```

Legacy `make` shortcuts are still available:

- `make run`
- `make ls-osaka`
- `make sync`
