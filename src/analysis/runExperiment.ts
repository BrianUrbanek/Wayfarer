import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExperimentSuite, writeExperimentSuiteFiles } from './reportExperiment.js';
import { listExperimentScenarioDefinitions } from './scenarios.js';

function parseCsv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries.length > 0 ? entries : undefined;
}

function parseNumberCsv(value: string | undefined): number[] | undefined {
  const entries = parseCsv(value);
  if (!entries) {
    return undefined;
  }

  const numbers = entries.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry));
  return numbers.length > 0 ? numbers : undefined;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | undefined> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) {
      continue;
    }

    const key = entry.slice(2);
    if (key === 'help') {
      args.help = 'true';
      continue;
    }

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
  const scenarios = listExperimentScenarioDefinitions()
    .map((scenario) => `  - ${scenario.slug}: ${scenario.label}`)
    .join('\n');

  console.log([
    'Wayfarer experiment harness',
    '',
    'Usage:',
    '  npm run analyze:runs -- [--scenario baseline|low-alignment|all|slug1,slug2] [--output <dir>] [--seeds 1,2,3]',
    '',
    'Flags:',
    '  --scenario   Comma-separated scenario slugs, or "all". Default: baseline',
    '  --output     Output directory for experiment-suite.json and experiment-suite.md',
    '  --seeds      Comma-separated numeric seeds to override the scenario defaults',
    '',
    'Available scenarios:',
    scenarios
  ].join('\n'));
}

export function runExperimentCli(argv: string[]): number {
  const args = parseArgs(argv);

  if (args.help === 'true') {
    printHelp();
    return 0;
  }

  const selectedScenarioSlugs = (() => {
    const requested = parseCsv(args.scenario);
    if (!requested || requested.length === 0 || requested[0] === 'baseline') {
      return ['baseline'];
    }

    if (requested.length === 1 && requested[0] === 'all') {
      return listExperimentScenarioDefinitions().map((scenario) => scenario.slug);
    }

    return requested;
  })();

  const suite = runExperimentSuite({
    scenarioSlugs: selectedScenarioSlugs,
    outputDirectory: args.output ? resolve(process.cwd(), args.output) : undefined,
    seeds: parseNumberCsv(args.seeds)
  });
  const written = writeExperimentSuiteFiles(suite);

  console.log(`Experiment suite written to ${suite.outputDirectory}`);
  console.log(`JSON: ${written.jsonPath}`);
  console.log(`Markdown: ${written.markdownPath}`);

  return 0;
}

const isMainModule = typeof process.argv[1] === 'string' && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const exitCode = runExperimentCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
