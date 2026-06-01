import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runModelingFixture } from './index.js';
import { listModelingFixtureIds } from './fixtures.js';

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const args: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) {
      continue;
    }

    const key = entry.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function printHelp(): void {
  console.log([
    'Wayfarer modeling core harness',
    '',
    'Usage:',
    '  npm run model:lab -- [--fixture basic|meh-observed] [--output <path>]',
    '',
    'Fixtures:',
    ...listModelingFixtureIds().map((id) => `  - ${id}`),
    '',
    'The harness writes JSON trace output to stdout and optionally to --output.'
  ].join('\n'));
}

export function runModelingHarness(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help === 'true') {
    printHelp();
    return 0;
  }

  const fixtureId = args.fixture ?? 'basic';
  const trace = runModelingFixture(fixtureId);
  const json = JSON.stringify(trace, null, 2);

  console.log(json);

  if (args.output) {
    const outputPath = resolve(process.cwd(), args.output);
    writeFileSync(outputPath, `${json}\n`, 'utf8');
    console.log(`Wrote modeling trace to ${outputPath}`);
  }

  return 0;
}

const isMainModule = typeof process.argv[1] === 'string' && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const exitCode = runModelingHarness(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
