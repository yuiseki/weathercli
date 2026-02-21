#!/usr/bin/env node
import path from 'path';
import { Command } from 'commander';
import { config, setConfigOverrides, type WeatherCliConfig } from './config';
import {
  formatWeatherReport,
  loadWeather,
  resolveLocationRequest,
  type ResolveLocationInput,
} from './weather';

type CommonCommandOptions = {
  city?: string;
  tokyo?: boolean;
  osaka?: boolean;
  nagoya?: boolean;
  sapporo?: boolean;
  fukuoka?: boolean;
  lat?: string;
  lon?: string;
  json?: boolean;
  cacheDir?: string;
  cacheTtlMinutes?: string;
};

type ListCommandOptions = CommonCommandOptions & {
  sync?: boolean;
};

type SyncCommandOptions = CommonCommandOptions;

export function parsePositiveIntegerOption(value: string, optionName: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

export function parseCoordinateOption(
  value: string,
  optionName: string,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${optionName} must be a valid number.`);
  }

  if (parsed < min || parsed > max) {
    throw new Error(`${optionName} must be between ${min} and ${max}.`);
  }

  return parsed;
}

function configureRuntimeOptions(options: {
  cacheDir?: string;
  cacheTtlMinutes?: string;
}): void {
  const overrides: Partial<WeatherCliConfig> = {};

  if (options.cacheDir) {
    overrides.WEATHERCLI_CACHE_DIR = path.resolve(options.cacheDir);
  }

  if (options.cacheTtlMinutes) {
    overrides.WEATHERCLI_CACHE_TTL_MINUTES = parsePositiveIntegerOption(
      options.cacheTtlMinutes,
      '--cache-ttl-minutes',
    );
  }

  if (Object.keys(overrides).length > 0) {
    setConfigOverrides(overrides);
  }
}

function resolveLocationInput(options: CommonCommandOptions): ResolveLocationInput {
  const latitude =
    typeof options.lat === 'string'
      ? parseCoordinateOption(options.lat, '--lat', -90, 90)
      : undefined;
  const longitude =
    typeof options.lon === 'string'
      ? parseCoordinateOption(options.lon, '--lon', -180, 180)
      : undefined;

  return {
    city: options.city,
    tokyo: Boolean(options.tokyo),
    osaka: Boolean(options.osaka),
    nagoya: Boolean(options.nagoya),
    sapporo: Boolean(options.sapporo),
    fukuoka: Boolean(options.fukuoka),
    latitude,
    longitude,
  };
}

async function executeList(options: ListCommandOptions): Promise<void> {
  configureRuntimeOptions(options);

  const locationRequest = resolveLocationRequest(resolveLocationInput(options));
  const loaded = await loadWeather({
    request: locationRequest,
    cacheDir: config.WEATHERCLI_CACHE_DIR,
    cacheTtlMinutes: config.WEATHERCLI_CACHE_TTL_MINUTES,
    forceSync: Boolean(options.sync),
  });

  if (options.json) {
    console.log(JSON.stringify(loaded, null, 2));
    return;
  }

  console.log(formatWeatherReport(loaded));
}

async function executeSync(options: SyncCommandOptions): Promise<void> {
  configureRuntimeOptions(options);

  const locationRequest = resolveLocationRequest(resolveLocationInput(options));
  const loaded = await loadWeather({
    request: locationRequest,
    cacheDir: config.WEATHERCLI_CACHE_DIR,
    cacheTtlMinutes: config.WEATHERCLI_CACHE_TTL_MINUTES,
    forceSync: true,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          ...loaded,
          cacheDir: config.WEATHERCLI_CACHE_DIR,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('Sync completed.');
  console.log(`Cache key: ${loaded.cacheKey}`);
  console.log(`Cache dir: ${config.WEATHERCLI_CACHE_DIR}`);
  console.log(formatWeatherReport(loaded));
}

function configureLocationOptions(command: Command): Command {
  return command
    .option('-c, --city <name>', 'Preset city name (tokyo, osaka, nagoya, sapporo, fukuoka)')
    .option('--tokyo', 'Shortcut for --city tokyo')
    .option('--osaka', 'Shortcut for --city osaka')
    .option('--nagoya', 'Shortcut for --city nagoya')
    .option('--sapporo', 'Shortcut for --city sapporo')
    .option('--fukuoka', 'Shortcut for --city fukuoka')
    .option('--lat <number>', 'Latitude for coordinate lookup')
    .option('--lon <number>', 'Longitude for coordinate lookup');
}

function configureRuntimeFlags(command: Command): Command {
  return command
    .option('-j, --json', 'Output as JSON')
    .option('--cache-dir <path>', 'Override cache directory')
    .option('--cache-ttl-minutes <minutes>', 'Cache freshness window in minutes');
}

function buildProgram(): Command {
  const program = new Command();

  program
    .name('weather')
    .description('Weather CLI with IP/preset/coordinate lookup and local cache')
    .version('0.1.0');

  configureRuntimeFlags(
    configureLocationOptions(
      program
        .command('list', { isDefault: true })
        .alias('ls')
        .description('Show current weather and 3-day forecast'),
    ),
  )
    .option('--sync', 'Force refresh and bypass cache')
    .action(async (options) => {
      await executeList(options as ListCommandOptions);
    });

  configureRuntimeFlags(
    configureLocationOptions(program.command('sync').description('Force refresh cache now')),
  ).action(async (options) => {
    await executeSync(options as SyncCommandOptions);
  });

  return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

if (require.main === module) {
  runCli()
    .then(() => {
      process.exit(0);
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Error:', error);
      }
      process.exit(1);
    });
}
