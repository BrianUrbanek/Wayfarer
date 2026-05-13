import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openExperimentReport, resolveExperimentReportTarget } from './reportOpening.js';

function parseArgs(argv: string[]): { path?: string; help?: boolean } {
  const args: { path?: string; help?: boolean } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) {
      continue;
    }

    const key = entry.slice(2);
    if (key === 'help') {
      args.help = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      continue;
    }

    if (key === 'path') {
      args.path = next;
    }

    index += 1;
  }

  return args;
}

function printHelp(): void {
  console.log([
    'Wayfarer experiment report opener',
    '',
    'Usage:',
    '  npm run analyze:open',
    '  npm run analyze:open -- --path artifacts\\experiments\\<run>\\experiment-suite.md',
    '',
    'The command opens the latest Markdown report under artifacts/experiments/ using the system default viewer.'
  ].join('\n'));
}

export function runOpenLatestExperimentReport(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }

  const experimentsRoot = resolve(process.cwd(), 'artifacts', 'experiments');
  const resolution = resolveExperimentReportTarget(experimentsRoot, args.path);

  if (resolution.status === 'missing') {
    console.log(resolution.message);
    return 1;
  }

  openExperimentReport(resolution.reportPath);
  console.log(resolution.message);
  console.log(`Opened: ${resolution.reportPath}`);
  return 0;
}

const isMainModule = typeof process.argv[1] === 'string' && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const exitCode = runOpenLatestExperimentReport(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
