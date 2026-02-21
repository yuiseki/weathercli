# ADR 001: CLI Structure and Commands

## Status
Accepted

## Context
The original `weathercli` implementation used a single script with ad-hoc flag parsing and no command structure. We also need historical cache lookup by date.

## Decision
Adopt a `commander`-based CLI with explicit commands while preserving legacy shortcuts (`--tokyo`, `--sync`, and `make ls-*`).

### 1. Root command
- Binary: `weather` (`weathercli` alias is kept for compatibility)
- Version: `weather --version`

### 2. List command
- `weather`
- `weather list` (alias: `weather ls`)
- Output: current weather + 3-day forecast
- Options:
  - `--sync` (today only)
  - `--date <yyyy-mm-dd>`
  - `--city <name>`
  - `--tokyo` / `--osaka` / `--nagoya` / `--sapporo` / `--fukuoka`
  - `--lat <number>`
  - `--lon <number>`
  - `--json`
  - `--cache-dir <path>`
  - `--cache-ttl-minutes <minutes>`

### 3. Sync command
- `weather sync`
- Same location/runtime options as `list`
- Behavior: always bypass cache and rewrite today's snapshot

## Consequences
- CLI behavior is explicit and testable.
- Existing automation using legacy shortcut flags keeps working.
- Historical read with `--date` is available without API backfill for past dates.
