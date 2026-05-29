import { useEffect, useMemo, useState } from 'react';
import { Panel } from './Panel';
import type { SystemMovementAnalysis, SystemMovementDomain, SystemMovementPoint, SystemMovementSignalType } from '../../model/systemMovement';

interface SystemMovementPanelProps {
  analysis: SystemMovementAnalysis;
  collapsed?: boolean;
}

const signalMeta: Record<SystemMovementSignalType, { label: string; color: string; description: string }> = {
  'narrow-appeal': {
    label: 'Narrow Appeal',
    color: '#67d7c7',
    description: 'A specific audience slice has a clear read.'
  },
  'broad-appeal': {
    label: 'Broad Appeal',
    color: '#8da4ff',
    description: 'Multiple cohorts show usable positive fit.'
  },
  'polarized-appeal': {
    label: 'Polarized Appeal',
    color: '#ffb36b',
    description: 'Clear positive and negative cohort reads coexist.'
  },
  'coverage-gap': {
    label: 'Coverage Gap',
    color: '#f2d36b',
    description: 'An important audience slice remains underknown.'
  },
  contradiction: {
    label: 'Contradiction',
    color: '#ff8b8b',
    description: 'Behavior is pushing against the rating-derived read.'
  },
  volatility: {
    label: 'Volatility',
    color: '#c79cff',
    description: 'The learned profile is moving too much to treat as stable.'
  }
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}`;
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }
  return formatSigned(value);
}

function xFor(value: number, domain: SystemMovementDomain): number {
  const span = Math.max(0.001, domain.xMax - domain.xMin);
  return 90 + ((value - domain.xMin) / span) * 780;
}

function yFor(value: number, domain: SystemMovementDomain): number {
  const span = Math.max(0.001, domain.yMax - domain.yMin);
  return 430 - ((value - domain.yMin) / span) * 340;
}

function radiusFor(value: number, maxValue: number): number {
  return 5 + Math.sqrt(Math.max(0, value) / Math.max(1, maxValue)) * 17;
}

function movementScore(point: SystemMovementPoint): number {
  const previous = point.trail.at(-1);
  if (!previous) {
    return 0;
  }
  return Math.abs(point.profilePosition - previous.profilePosition) + Math.abs(point.legibility - previous.legibility);
}

function pointSummary(point: SystemMovementPoint): string {
  return `${point.islandLabel}: ${signalMeta[point.dominantSignal].label}, profile ${formatSigned(point.profilePosition)}, legibility ${formatPercent(point.legibility)}, evidence ${point.evidenceWeight.toFixed(1)}`;
}

export function SystemMovementPanel({ analysis, collapsed = false }: SystemMovementPanelProps) {
  const latestTurn = analysis.frames.at(-1)?.turn ?? 0;
  const [selectedTurn, setSelectedTurn] = useState(latestTurn);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [scaleMode, setScaleMode] = useState<'fit' | 'absolute'>('fit');

  useEffect(() => {
    setSelectedTurn(latestTurn);
  }, [latestTurn]);

  const selectedFrame = useMemo(
    () => analysis.frames.find((frame) => frame.turn === selectedTurn) ?? analysis.frames.at(-1) ?? null,
    [analysis.frames, selectedTurn]
  );
  const turnValues = analysis.frames.map((frame) => frame.turn);
  const minTurn = turnValues[0] ?? 0;
  const maxTurn = turnValues.at(-1) ?? 0;
  const focusPoints = selectedFrame
    ? selectedFrame.points
        .slice()
        .sort((left, right) => movementScore(right) - movementScore(left) || right.evidenceWeight - left.evidenceWeight)
        .slice(0, 4)
    : [];
  const selectedAuditRows = selectedFrame
    ? analysis.auditRows
        .filter((row) => row.turn === selectedFrame.turn)
        .slice()
        .sort((left, right) => right.movementScore - left.movementScore || right.evidenceWeight - left.evidenceWeight)
        .slice(0, 6)
    : [];
  const activeDomain = scaleMode === 'fit' && selectedFrame ? selectedFrame.domain : { xMin: -1, xMax: 1, yMin: 0, yMax: 1 };
  const xTicks = [activeDomain.xMin, activeDomain.xMin + (activeDomain.xMax - activeDomain.xMin) / 2, activeDomain.xMax];
  const yTicks = [activeDomain.yMin, activeDomain.yMin + (activeDomain.yMax - activeDomain.yMin) / 2, activeDomain.yMax];

  const exportMovementJson = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        scaleMode,
        frames: analysis.frames,
        auditRows: analysis.auditRows,
        signalCounts: analysis.signalCounts
      },
      null,
      2
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'wayfarer-system-movement.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="system-movement__layout">
      <div className="system-movement__intro">
        <div>
          <p className="eyebrow">Post-run visualization</p>
          <h3>Total movement in learned audience fit</h3>
          <p className="muted">
            Each island is positioned by learned profile fit and legibility. Size is evidence weight; color is the dominant signal type.
          </p>
          <p className="muted">
            Scale: {scaleMode === 'fit' ? `fit to current run (${formatSigned(activeDomain.xMin)} to ${formatSigned(activeDomain.xMax)}, ${formatPercent(activeDomain.yMin)} to ${formatPercent(activeDomain.yMax)})` : 'absolute (-1 to +1, 0% to 100%)'}.
          </p>
        </div>
        <div className="system-movement__metrics" aria-label={`Turn ${selectedFrame?.turn ?? latestTurn} system movement metrics`}>
          <span>
            <strong>{selectedFrame?.summary.islandCount ?? 0}</strong>
            <span>islands</span>
          </span>
          <span>
            <strong>{formatPercent(selectedFrame?.summary.averageLegibility ?? 0)}</strong>
            <span>avg profile read</span>
          </span>
          <span>
            <strong>{selectedFrame?.summary.coverageGapCount ?? 0}</strong>
            <span>coverage gaps</span>
          </span>
          <span>
            <strong>{(selectedFrame?.summary.contradictionCount ?? 0) + (selectedFrame?.summary.volatilityCount ?? 0)}</strong>
            <span>unstable reads</span>
          </span>
        </div>
      </div>

      {selectedFrame ? (
        <>
          <div className="system-movement__mode-row">
            <div className="topbar__mode" role="group" aria-label="System Movement scale mode">
              <button type="button" className={`segmented-button${scaleMode === 'fit' ? ' segmented-button--active' : ''}`} aria-pressed={scaleMode === 'fit'} onClick={() => setScaleMode('fit')}>
                Fit to run
              </button>
              <button type="button" className={`segmented-button${scaleMode === 'absolute' ? ' segmented-button--active' : ''}`} aria-pressed={scaleMode === 'absolute'} onClick={() => setScaleMode('absolute')}>
                Absolute
              </button>
            </div>
            <button type="button" className="button button--ghost" onClick={exportMovementJson}>
              Export movement JSON
            </button>
          </div>
          <div className="system-movement__chart-wrap">
            <svg className="system-movement__chart" viewBox="0 0 960 520" role="img" aria-label={`System movement scatter plot for turn ${selectedFrame.turn}`}>
              <defs>
                <linearGradient id="systemMovementXAxis" x1="0" x2="1">
                  <stop offset="0%" stopColor="rgba(255,139,139,0.22)" />
                  <stop offset="50%" stopColor="rgba(174,185,218,0.16)" />
                  <stop offset="100%" stopColor="rgba(103,215,199,0.22)" />
                </linearGradient>
              </defs>
              <rect x="60" y="54" width="840" height="406" rx="18" className="system-movement__plot-bg" />
              <rect x="90" y="430" width="780" height="2" fill="url(#systemMovementXAxis)" />
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line x1="90" x2="870" y1={yFor(tick, activeDomain)} y2={yFor(tick, activeDomain)} className="system-movement__grid-line" />
                  <text x="72" y={yFor(tick, activeDomain) + 4} className="system-movement__axis-label" textAnchor="end">
                    {formatPercent(tick)}
                  </text>
                </g>
              ))}
              {xTicks.map((tick) => (
                <g key={tick}>
                  <line x1={xFor(tick, activeDomain)} x2={xFor(tick, activeDomain)} y1="90" y2="430" className="system-movement__grid-line system-movement__grid-line--vertical" />
                  <text x={xFor(tick, activeDomain)} y="456" className="system-movement__axis-label" textAnchor="middle">
                    {formatSigned(tick)}
                  </text>
                </g>
              ))}
              {activeDomain.xMin < 0 && activeDomain.xMax > 0 ? (
                <line x1={xFor(0, activeDomain)} x2={xFor(0, activeDomain)} y1="90" y2="430" className="system-movement__zero-line" />
              ) : null}
              <text x="480" y="494" className="system-movement__axis-title" textAnchor="middle">
                Profile position / affinity centroid
              </text>
              <text x="22" y="260" className="system-movement__axis-title system-movement__axis-title--y" textAnchor="middle">
                Confidence / legibility
              </text>

              {selectedFrame.points.map((point) => {
                const color = signalMeta[point.dominantSignal].color;
                const trail = point.trail.concat({ turn: point.turn, profilePosition: point.profilePosition, legibility: point.legibility });
                const path = trail.map((trailPoint, index) => `${index === 0 ? 'M' : 'L'} ${xFor(trailPoint.profilePosition, activeDomain)} ${yFor(trailPoint.legibility, activeDomain)}`).join(' ');
                return (
                  <g key={`${point.turn}-${point.islandId}`}>
                    {trail.length > 1 ? <path d={path} className="system-movement__trail" stroke={color} /> : null}
                    <circle
                      cx={xFor(point.profilePosition, activeDomain)}
                      cy={yFor(point.legibility, activeDomain)}
                      r={radiusFor(point.evidenceWeight, analysis.maxEvidenceWeight)}
                      fill={color}
                      className="system-movement__dot"
                    >
                      <title>{pointSummary(point)}</title>
                    </circle>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="system-movement__controls">
            <label className="system-movement__slider">
              <span>Turn {selectedFrame.turn}</span>
              <input
                type="range"
                min={minTurn}
                max={maxTurn}
                step="1"
                value={selectedFrame.turn}
                onChange={(event) => setSelectedTurn(Number(event.target.value))}
              />
            </label>
            <div className="system-movement__legend" aria-label="Dominant signal type legend">
              {(Object.keys(signalMeta) as SystemMovementSignalType[]).map((signal) => (
                <span key={signal} className="system-movement__legend-item">
                  <span style={{ background: signalMeta[signal].color }} aria-hidden="true" />
                  {signalMeta[signal].label}
                </span>
              ))}
            </div>
          </div>

          <div className="system-movement__readout">
            <div className="notice notice--subtle">
              <p>
                Negative affinity is information; uncertainty is risk. A high-legibility island can still be colored as Coverage Gap when one audience slice remains underknown.
              </p>
            </div>
            <div className="system-movement__focus-list">
              <h4>Largest recent movers</h4>
              {focusPoints.length ? (
                <ul>
                  {focusPoints.map((point) => (
                    <li key={point.islandId}>
                      <strong>{point.islandLabel}</strong>
                      <span>{signalMeta[point.dominantSignal].label}</span>
                      <span>{formatPercent(point.legibility)} profile read</span>
                      <span>{formatSigned(point.profilePosition)} profile</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No prior turn trail is available yet.</p>
              )}
            </div>
          </div>
          <div className="system-movement__audit">
            <h4>Movement audit</h4>
            <div className="report-table-wrap">
              <table className="report-table report-table--dense system-movement__audit-table">
                <thead>
                  <tr>
                    <th scope="col">Island</th>
                    <th scope="col">Signal</th>
                    <th scope="col" className="report-table__cell--right">X delta</th>
                    <th scope="col" className="report-table__cell--right">Y delta</th>
                    <th scope="col" className="report-table__cell--right">Evidence delta</th>
                    <th scope="col">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAuditRows.map((row) => (
                    <tr key={`${row.turn}-${row.islandId}`}>
                      <td>{row.islandLabel}</td>
                      <td>{signalMeta[row.dominantSignal].label}</td>
                      <td className="report-table__cell--right">{formatDelta(row.profileDelta)}</td>
                      <td className="report-table__cell--right">{formatDelta(row.legibilityDelta)}</td>
                      <td className="report-table__cell--right">{formatDelta(row.evidenceDelta)}</td>
                      <td>{row.moverReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <strong>No movement frames</strong>
          <p>Execute or import a run with island/cohort snapshots to inspect system movement over turns.</p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Panel id="system-movement" title="System Movement" className="panel--full system-movement" collapsible defaultCollapsed={collapsed}>
        <div className="system-movement__toolbar">
          <button type="button" className="button button--primary" onClick={() => setFullscreenOpen(true)}>
            Open full screen
          </button>
        </div>
        {content}
      </Panel>
      {fullscreenOpen ? (
        <div className="overlay overlay--modal system-movement-modal" role="dialog" aria-modal="true" aria-label="System Movement full screen">
          <section className="system-movement-modal__surface">
            <div className="system-movement-modal__header">
              <div>
                <p className="modal__eyebrow">System Movement</p>
                <h2>Turn-over-turn audience-fit movement</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setFullscreenOpen(false)} aria-label="Close System Movement full screen">
                X
              </button>
            </div>
            <div className="system-movement-modal__body">{content}</div>
          </section>
        </div>
      ) : null}
    </>
  );
}
