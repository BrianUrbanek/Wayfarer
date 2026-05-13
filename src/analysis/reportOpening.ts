import { accessSync, constants, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export type ExperimentReportTargetStatus = 'found' | 'missing';

export interface ExperimentReportTargetFound {
  readonly status: 'found';
  readonly experimentsRoot: string;
  readonly outputDirectory: string;
  readonly reportPath: string;
  readonly message: string;
}

export interface ExperimentReportTargetMissing {
  readonly status: 'missing';
  readonly experimentsRoot: string;
  readonly message: string;
}

export type ExperimentReportTargetResolution = ExperimentReportTargetFound | ExperimentReportTargetMissing;

interface ExperimentReportCandidate {
  readonly outputDirectory: string;
  readonly reportPath: string;
  readonly mtimeMs: number;
}

function existsReadable(pathValue: string): boolean {
  try {
    accessSync(pathValue, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExplicitReportPath(explicitPath: string): string {
  const resolved = resolve(explicitPath);
  return resolved.endsWith('.md') ? resolved : join(resolved, 'experiment-suite.md');
}

function readDirectoryMtime(outputDirectory: string): number {
  try {
    return statSync(outputDirectory).mtimeMs;
  } catch {
    return 0;
  }
}

function compareCandidates(left: ExperimentReportCandidate, right: ExperimentReportCandidate): number {
  const directoryComparison = basename(right.outputDirectory).localeCompare(basename(left.outputDirectory));
  if (directoryComparison !== 0) {
    return directoryComparison;
  }

  if (right.mtimeMs !== left.mtimeMs) {
    return right.mtimeMs - left.mtimeMs;
  }

  return right.outputDirectory.localeCompare(left.outputDirectory);
}

function collectCandidates(experimentsRoot: string): ExperimentReportCandidate[] {
  if (!existsReadable(experimentsRoot)) {
    return [];
  }

  return readdirSync(experimentsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const outputDirectory = join(experimentsRoot, entry.name);
      const reportPath = join(outputDirectory, 'experiment-suite.md');

      if (!existsReadable(reportPath)) {
        return null;
      }

      return {
        outputDirectory,
        reportPath,
        mtimeMs: readDirectoryMtime(outputDirectory)
      };
    })
    .filter((candidate): candidate is ExperimentReportCandidate => candidate !== null)
    .sort(compareCandidates);
}

export function resolveExperimentReportTarget(
  experimentsRoot: string,
  explicitPath?: string
): ExperimentReportTargetResolution {
  const normalizedRoot = resolve(experimentsRoot);

  if (explicitPath) {
    const reportPath = resolveExplicitReportPath(explicitPath);
    if (!existsReadable(reportPath)) {
      return {
        status: 'missing',
        experimentsRoot: normalizedRoot,
        message: `No experiment report found at ${reportPath}. Please run \`npm run analyze:runs\` first.`
      };
    }

    return {
      status: 'found',
      experimentsRoot: normalizedRoot,
      outputDirectory: resolve(reportPath, '..'),
      reportPath,
      message: `Opening experiment report: ${reportPath}`
    };
  }

  const [latest] = collectCandidates(normalizedRoot);
  if (!latest) {
    return {
      status: 'missing',
      experimentsRoot: normalizedRoot,
      message: `No experiment reports found under ${normalizedRoot}. Please run \`npm run analyze:runs\` first.`
    };
  }

  return {
    status: 'found',
    experimentsRoot: normalizedRoot,
    outputDirectory: latest.outputDirectory,
    reportPath: latest.reportPath,
    message: `Opening experiment report: ${latest.reportPath}`
  };
}

export interface OpenExperimentReportResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly reportPath: string;
}

export function openExperimentReport(reportPath: string): OpenExperimentReportResult {
  const normalizedPath = resolve(reportPath);

  if (process.platform === 'win32') {
    const command = 'cmd';
    const args = ['/c', 'start', '', normalizedPath];
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
      windowsVerbatimArguments: true
    });
    child.unref();
    return { command, args, reportPath: normalizedPath };
  }

  if (process.platform === 'darwin') {
    const command = 'open';
    const args = [normalizedPath];
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true
    });
    child.unref();
    return { command, args, reportPath: normalizedPath };
  }

  const command = 'xdg-open';
  const args = [normalizedPath];
  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: true
  });
  child.unref();
  return { command, args, reportPath: normalizedPath };
}
