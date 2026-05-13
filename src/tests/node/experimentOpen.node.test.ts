import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveExperimentReportTarget } from '../../analysis/reportOpening.js';

function makeReportRun(root: string, name: string, contents = '# Report\n'): string {
  const outputDirectory = join(root, name);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(join(outputDirectory, 'experiment-suite.md'), contents, 'utf8');
  writeFileSync(join(outputDirectory, 'experiment-suite.json'), '{}\n', 'utf8');
  return outputDirectory;
}

describe('experiment report opener', () => {
  it('selects the latest experiment report directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'wayfarer-open-'));
    makeReportRun(root, '2026-05-13-01-00-00Z-suite');
    makeReportRun(root, '2026-05-13-02-00-00Z-suite');

    const resolution = resolveExperimentReportTarget(root);

    assert.equal(resolution.status, 'found');
    assert.equal(resolution.reportPath, join(root, '2026-05-13-02-00-00Z-suite', 'experiment-suite.md'));
    assert.ok(resolution.message.includes('Opening'));
  });

  it('reports a missing experiments root cleanly', () => {
    const root = join(tmpdir(), `wayfarer-open-missing-${Date.now()}`);

    const resolution = resolveExperimentReportTarget(root);

    assert.equal(resolution.status, 'missing');
    assert.ok(resolution.message.includes('run `npm run analyze:runs` first'));
  });

  it('honors an explicit report path override', () => {
    const root = mkdtempSync(join(tmpdir(), 'wayfarer-open-'));
    const outputDirectory = makeReportRun(root, '2026-05-13-03-00-00Z-suite');
    const explicitReportPath = join(outputDirectory, 'experiment-suite.md');

    const resolution = resolveExperimentReportTarget(root, explicitReportPath);

    assert.equal(resolution.status, 'found');
    assert.equal(resolution.reportPath, explicitReportPath);
  });
});
