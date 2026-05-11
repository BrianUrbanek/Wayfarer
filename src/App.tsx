import { useEffect, useMemo, useState } from 'react';
import { Badge } from './ui/components/Badge';
import { Drawer } from './ui/components/Drawer';
import { EmptyState } from './ui/components/EmptyState';
import { MetricCard } from './ui/components/MetricCard';
import { Modal } from './ui/components/Modal';
import { Panel } from './ui/components/Panel';
import { ProgressBar } from './ui/components/ProgressBar';
import { ReportTable, type ReportTableColumn } from './ui/components/ReportTable';
import { SelectionModal, type SelectionOption } from './ui/components/SelectionModal';
import { DistributionList } from './ui/components/DistributionList';
import { DEFAULT_TAGS } from './data/defaultTags';
import { createDefaultCohorts } from './data/defaultCohorts';
import { generateColumbusDataset } from './generator/columbusGenerator';
import type { PseudoCohortReport } from './model/pseudoCohorts';
import {
  advancePassiveTurn,
  createInitialSimulationState,
  type SimulationState
} from './model/simulation';
import type { CohortAnchor, Island, User } from './model/types';

const INITIAL_CONFIG = {
  seed: 48291,
  numUsers: 48,
  numIslands: 18
};

type SelectionModalKind = 'user' | 'island' | 'cohort' | 'pseudo' | null;

type DrawerState =
  | { type: 'user'; id: string }
  | { type: 'island'; id: string }
  | { type: 'pseudo'; key: string }
  | null;

function buildDataset(seed: number, numUsers: number, numIslands: number) {
  return generateColumbusDataset({
    seed,
    numUsers,
    numIslands,
    cohorts: createDefaultCohorts(),
    allTags: DEFAULT_TAGS,
    tagAlignmentDistribution: { kind: 'uniform', min: 2, max: 10 },
    ratingAlignmentDistribution: { kind: 'uniform', min: 2, max: 10 }
  });
}

function labelForCohortFactory(cohorts: CohortAnchor[]) {
  const labels = new Map(cohorts.map((cohort) => [cohort.id, cohort.label]));

  return (cohortId: string | null) => {
    if (cohortId === null) {
      return 'none';
    }

    return labels.get(cohortId) ?? cohortId;
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatRating(value: string | number | null): string {
  if (value === null || value === undefined) {
    return 'Unrated';
  }

  return String(value);
}

function diagnosisTone(type: string): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'HIGH_SIGNAL':
      return 'success';
    case 'MISMATCH_RETAG':
      return 'warning';
    case 'INVERSE_PROFILE':
      return 'danger';
    case 'UNKNOWN_OR_NOISY':
      return 'neutral';
    case 'LOW_SIGNAL':
      return 'warning';
    default:
      return 'neutral';
  }
}

function comparisonLabel(user: User | null, selectedCohort: CohortAnchor | null, cohortLabel: (id: string | null) => string) {
  if (selectedCohort) {
    return selectedCohort.label;
  }

  if (user) {
    return cohortLabel(user.hiddenSeedCohortId ?? null);
  }

  return 'none';
}

function countNonNullRatings(user: User): number {
  return Object.values(user.ratings).filter((value) => value !== null).length;
}

function computeExactMatchRate(user: User, cohort: CohortAnchor, islandIds: string[]) {
  let matches = 0;
  let rated = 0;

  for (const islandId of islandIds) {
    const userRating = user.ratings[islandId] ?? null;
    const cohortRating = cohort.ratings[islandId] ?? null;

    if (userRating === null || cohortRating === null) {
      continue;
    }

    rated += 1;
    if (userRating === cohortRating) {
      matches += 1;
    }
  }

  return {
    matches,
    rated,
    rate: rated > 0 ? matches / rated : 0
  };
}

function buildPopulationSummary(datasetUserCount: number, totalUsers: number, inferenceTypes: Map<string, string>, pseudoReports: number) {
  let highSignal = 0;
  let retagCandidates = 0;
  let inverseProfiles = 0;
  let noisyUsers = 0;

  inferenceTypes.forEach((type) => {
    if (type === 'HIGH_SIGNAL') {
      highSignal += 1;
    } else if (type === 'MISMATCH_RETAG') {
      retagCandidates += 1;
    } else if (type === 'INVERSE_PROFILE') {
      inverseProfiles += 1;
    } else if (type === 'UNKNOWN_OR_NOISY' || type === 'AMBIGUOUS' || type === 'LOW_SIGNAL') {
      noisyUsers += 1;
    }
  });

  return {
    totalUsers,
    generatedUsers: datasetUserCount,
    highSignal,
    retagCandidates,
    inverseProfiles,
    noisyUsers,
    pseudoReports
  };
}

function pseudoPriorityTone(priority: PseudoCohortReport['analystPriority']) {
  switch (priority) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'accent';
    default:
      return 'neutral';
  }
}

export default function App() {
  const [seed, setSeed] = useState(INITIAL_CONFIG.seed);
  const [numUsers, setNumUsers] = useState(INITIAL_CONFIG.numUsers);
  const [numIslands, setNumIslands] = useState(INITIAL_CONFIG.numIslands);
  const [initialRatingsPerUser, setInitialRatingsPerUser] = useState(4);
  const [activeUsersPerTurn, setActiveUsersPerTurn] = useState(6);
  const [maxRatingsPerActiveUser, setMaxRatingsPerActiveUser] = useState(3);
  const [turnBatchCount, setTurnBatchCount] = useState(5);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedIslandId, setSelectedIslandId] = useState<string>('');
  const [comparisonCohortId, setComparisonCohortId] = useState<string>('auto');
  const [showDebug, setShowDebug] = useState(true);
  const [showAbout, setShowAbout] = useState(true);
  const [modalKind, setModalKind] = useState<SelectionModalKind>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>(null);

  const latentDataset = useMemo(() => buildDataset(seed, numUsers, numIslands), [seed, numUsers, numIslands]);

  const initialSimulationState = useMemo(
    () =>
      createInitialSimulationState({
        seed,
        allTags: latentDataset.allTags,
        latentUsers: latentDataset.users,
        cohorts: latentDataset.cohorts,
        islands: latentDataset.islands,
        initialRatingsPerUser
      }),
    [initialRatingsPerUser, latentDataset, seed]
  );

  const [simulationState, setSimulationState] = useState<SimulationState>(initialSimulationState);

  useEffect(() => {
    setSimulationState(initialSimulationState);
  }, [initialSimulationState]);

  const dataset = simulationState;
  const labelForCohort = useMemo(() => labelForCohortFactory(dataset.cohorts), [dataset.cohorts]);

  useEffect(() => {
    if (!dataset.users.length) {
      setSelectedUserId('');
      return;
    }

    if (!dataset.users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(dataset.users[0].id);
    }
  }, [dataset.users, selectedUserId]);

  useEffect(() => {
    if (!dataset.islands.length) {
      setSelectedIslandId('');
      return;
    }

    if (!dataset.islands.some((island) => island.id === selectedIslandId)) {
      setSelectedIslandId(dataset.islands[0].id);
    }
  }, [dataset.islands, selectedIslandId]);

  const selectedUser = useMemo(() => {
    return dataset.users.find((user) => user.id === selectedUserId) ?? dataset.users[0] ?? null;
  }, [dataset.users, selectedUserId]);

  const selectedIsland = useMemo(() => {
    return dataset.islands.find((island) => island.id === selectedIslandId) ?? dataset.islands[0] ?? null;
  }, [dataset.islands, selectedIslandId]);

  const selectedInference = selectedUser ? dataset.inferenceByUserId.get(selectedUser.id) : undefined;

  const selectedComparisonCohort = useMemo(() => {
    if (comparisonCohortId !== 'auto') {
      return dataset.cohorts.find((cohort) => cohort.id === comparisonCohortId) ?? null;
    }

    return (
      dataset.cohorts.find((cohort) => cohort.id === selectedInference?.behaviorTop.cohortId) ??
      dataset.cohorts.find((cohort) => cohort.id === selectedInference?.declaredTop.cohortId) ??
      dataset.cohorts[0] ??
      null
    );
  }, [comparisonCohortId, dataset.cohorts, selectedInference]);

  const selectedComparisonLabel = comparisonLabel(selectedUser, selectedComparisonCohort, labelForCohort);

  const inferenceTypes = useMemo(() => {
    return new Map(
      dataset.users.map((user) => [user.id, dataset.inferenceByUserId.get(user.id)?.diagnosis.type ?? 'AMBIGUOUS'])
    );
  }, [dataset.inferenceByUserId, dataset.users]);

  const populationSummary = useMemo(
    () =>
      buildPopulationSummary(
        dataset.users.length,
        dataset.users.length,
        inferenceTypes,
        dataset.pseudoCohortAnalysis.allReports.length
      ),
    [dataset.users.length, inferenceTypes, dataset.pseudoCohortAnalysis.allReports.length]
  );

  const selectedInferenceDiagnostics = selectedInference?.diagnosis;
  const currentTurnSummary = dataset.turnHistory[dataset.turnHistory.length - 1] ?? null;
  const selectedUserRatings = selectedUser ? countNonNullRatings(selectedUser) : 0;
  const selectedUserTopCohorts = selectedInference
    ? [
        {
          label: 'Declared',
          match: selectedInference.declaredTop
        },
        {
          label: 'Behavior',
          match: selectedInference.behaviorTop
        },
        {
          label: 'Inverse',
          match: selectedInference.inverseTop
        }
      ]
    : [];

  const selectedIslandRows = useMemo(() => {
    return dataset.cohorts.map((cohort) => ({
      cohort,
      rating: selectedIsland ? cohort.ratings[selectedIsland.id] ?? null : null
    }));
  }, [dataset.cohorts, selectedIsland]);

  const selectedComparisonUserRating = selectedUser && selectedIsland
    ? selectedUser.ratings[selectedIsland.id] ?? null
    : null;

  const selectedComparisonCohortRating = selectedComparisonCohort && selectedIsland
    ? selectedComparisonCohort.ratings[selectedIsland.id] ?? null
    : null;

  const exactMatchRate =
    selectedUser && selectedComparisonCohort
      ? computeExactMatchRate(
          selectedUser,
          selectedComparisonCohort,
          dataset.islands.map((island) => island.id)
        )
      : null;

  const behaviorIsNonInformative =
    selectedInference !== undefined &&
    selectedInference.behaviorMatchStrength < 0.35 &&
    selectedInference.behaviorSpecificity < 0.06;

  const selectedUserOptions = useMemo<SelectionOption[]>(() => {
    return dataset.users.map((user) => {
      const inference = dataset.inferenceByUserId.get(user.id);
      const tags = user.declaredTags.slice(0, 3).join(' Â· ');

      return {
        id: user.id,
        label: user.label,
        description: tags,
        badge: inference?.diagnosis.type ?? 'unknown'
      };
    });
  }, [dataset.inferenceByUserId, dataset.users]);

  const selectedIslandOptions = useMemo<SelectionOption[]>(() => {
    return dataset.islands.map((island) => {
      return {
        id: island.id,
        label: island.label,
        description: `Rated by ${dataset.cohorts.length} seeded anchors`,
        badge: island.hiddenClass ?? 'island'
      };
    });
  }, [dataset.cohorts.length, dataset.islands]);

  const comparisonCohortOptions = useMemo<SelectionOption[]>(() => {
    return [
      {
        id: 'auto',
        label: 'Behavior top (auto)',
        description: "Use the current user's strongest behavioral match."
      },
      ...dataset.cohorts.map((cohort) => ({
        id: cohort.id,
        label: cohort.label,
        description: cohort.tags.join(' Â· '),
        badge: cohort.source
      }))
    ];
  }, [dataset.cohorts]);

  const pseudoReportOptions = useMemo<SelectionOption[]>(() => {
    return dataset.pseudoCohortAnalysis.allReports.map((report) => ({
      id: report.key,
      label: report.tags.join(' | '),
      description: `${report.userCount} users Â· ${report.reportType}`,
      badge: report.analystPriority
    }));
  }, [dataset.pseudoCohortAnalysis.allReports]);

  const reportColumns: ReportTableColumn<PseudoCohortReport>[] = [
    {
      key: 'tags',
      label: 'Tag combo',
      render: (report) => report.tags.join(' | ')
    },
    {
      key: 'users',
      label: 'Users',
      render: (report) => report.userCount,
      align: 'right'
    },
    {
      key: 'consistency',
      label: 'Consistency',
      render: (report) => <ProgressBar value={Math.max(0, report.internalConsistency)} />
    },
    {
      key: 'fit',
      label: 'Known fit',
      render: (report) => formatPercent(report.averageKnownCohortFit),
      align: 'right'
    },
    {
      key: 'signal',
      label: 'Effective signal',
      render: (report) => formatPercent(report.averageEffectiveSignal),
      align: 'right'
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (report) => <Badge tone={pseudoPriorityTone(report.analystPriority)}>{report.analystPriority}</Badge>,
      align: 'center'
    }
  ];

  const selectedUserSummary = selectedInference ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Selected user</p>
          <h3>{selectedUser?.label ?? 'None'}</h3>
        </div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={() => setDrawerState(selectedUser ? { type: 'user', id: selectedUser.id } : null)}>
            Open detail
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('user')}>
            Select user
          </button>
        </div>
      </div>

      <div className="badge-row">
        {(selectedUser?.declaredTags ?? []).map((tag) => (
          <Badge key={tag} tone="accent">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Identity/Behavior Fit"
          value={selectedInference.signalFit.toFixed(3)}
          helper="Do this player's declared tags and observed ratings point toward the same cohort pattern?"
          tone="accent"
        />
        <MetricCard
          label="Rating Evidence"
          value={selectedInference.ratingEvidence.toFixed(3)}
          helper="How much sparse rating data supports this judgment?"
          tone="neutral"
        />
        <MetricCard
          label="Usable Signal"
          value={selectedInference.effectiveSignal.toFixed(3)}
          helper="How much weight the system should currently give this player's ratings."
          tone="success"
        />
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard
          label="Behavior match strength"
          value={selectedInference.behaviorMatchStrength.toFixed(3)}
          helper="Strongest raw positive cohort fit before the distribution is normalized."
        />
        <MetricCard
          label="Behavior specificity"
          value={selectedInference.behaviorSpecificity.toFixed(3)}
          helper="How much the behavior distribution prefers one cohort over the runner-up."
        />
      </div>

      <div className="summary-top-cohorts">
        {selectedUserTopCohorts.map(({ label, match }) => (
          <MetricCard
            key={label}
            label={`${label} top cohort`}
            value={labelForCohort(match.cohortId)}
            helper={`${formatPercent(match.score)} match`}
            tone="neutral"
          />
        ))}
      </div>

      <div className="summary-inline">
        <Badge tone={diagnosisTone(selectedInferenceDiagnostics?.type ?? 'AMBIGUOUS')}>
          {selectedInferenceDiagnostics?.type ?? 'AMBIGUOUS'}
        </Badge>
        <span className="muted">{selectedInferenceDiagnostics?.message}</span>
      </div>
    </div>
  ) : null;

  const selectedIslandSummary = selectedIsland ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Selected island</p>
          <h3>{selectedIsland.label}</h3>
        </div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={() => setDrawerState({ type: 'island', id: selectedIsland.id })}>
            Open detail
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('island')}>
            Select island
          </button>
        </div>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="User rating" value={formatRating(selectedComparisonUserRating)} helper="Visible rating from the selected user." />
        <MetricCard
          label="Comparison cohort"
          value={selectedComparisonLabel}
          helper="The cohort used for island comparison."
        />
        <MetricCard
          label="Cohort rating"
          value={formatRating(selectedComparisonCohortRating)}
          helper="The selected cohort's rating on this island."
        />
        <MetricCard
          label="Exact match rate"
          value={
            exactMatchRate
              ? `${exactMatchRate.matches}/${exactMatchRate.rated} (${formatPercent(exactMatchRate.rate)})`
              : 'Unrated'
          }
          helper="Matches across islands both the user and comparison cohort rated."
        />
      </div>

      <div className="summary-inline">
        <Badge tone="neutral">User rated: {selectedUserRatings}</Badge>
        <Badge tone="accent">Island comparison updates with selection</Badge>
      </div>
    </div>
  ) : null;

  const selectedUserDetail = selectedUser && selectedInference ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>Identity</h4>
        <p>{selectedUser.label}</p>
        <div className="badge-row">
          {selectedUser.declaredTags.map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
        </div>
      </section>
      <section className="detail-block">
        <h4>Ratings</h4>
        <p>{selectedUserRatings} islands rated</p>
      </section>
      <section className="detail-block">
        <h4>Diagnosis</h4>
        <p>{selectedInference.diagnosis.message}</p>
        <p className="muted">{selectedInference.diagnosis.reasons.join(' Â· ')}</p>
      </section>
      <section className="detail-block">
        <h4>Debug</h4>
        <p>Hidden seed: {selectedUser.hiddenSeedCohortId ? labelForCohort(selectedUser.hiddenSeedCohortId) : 'none'}</p>
        <p>Tag alignment: {selectedUser.hiddenTagAlignment ?? 'n/a'}</p>
        <p>Rating alignment: {selectedUser.hiddenRatingAlignment ?? 'n/a'}</p>
      </section>
    </div>
  ) : null;

  const selectedIslandDetail = selectedIsland ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>Island</h4>
        <p>{selectedIsland.label}</p>
        <p className="muted">Comparison cohort: {selectedComparisonLabel}</p>
      </section>
      <section className="detail-block">
        <h4>Visible ratings</h4>
        <p>User: {formatRating(selectedComparisonUserRating)}</p>
        <p>Cohort: {formatRating(selectedComparisonCohortRating)}</p>
      </section>
      <section className="detail-block">
        <h4>Seeded cohort ratings</h4>
        <div className="detail-mini-table">
          {selectedIslandRows.map(({ cohort, rating }) => (
            <div key={cohort.id} className="detail-mini-table__row">
              <span>{cohort.label}</span>
              <Badge tone={rating === 1 ? 'success' : rating === -1 ? 'danger' : 'warning'}>
                {formatRating(rating)}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  ) : null;

  const selectedPseudoDetail = drawerState?.type === 'pseudo'
    ? dataset.pseudoCohortAnalysis.allReports.find((report) => report.key === drawerState.key) ?? null
    : null;

  const pseudoDrawerContent = selectedPseudoDetail ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>{selectedPseudoDetail.tags.join(' | ')}</h4>
        <p className="muted">{selectedPseudoDetail.reportType}</p>
      </section>
      <section className="detail-block">
        <h4>Metrics</h4>
        <p>Users: {selectedPseudoDetail.userCount}</p>
        <p>Internal consistency: {selectedPseudoDetail.internalConsistency.toFixed(3)}</p>
        <p>Consistency evidence: {selectedPseudoDetail.consistencyEvidence.toFixed(3)}</p>
        <p>Known fit: {selectedPseudoDetail.averageKnownCohortFit.toFixed(3)}</p>
        <p>Usable Signal: {selectedPseudoDetail.averageEffectiveSignal.toFixed(3)}</p>
        <p>Priority: {selectedPseudoDetail.analystPriority}</p>
      </section>
      <section className="detail-block">
        <h4>Users</h4>
        <p className="muted">{selectedPseudoDetail.users.join(', ')}</p>
      </section>
    </div>
  ) : null;

  const modelExplanation = selectedInference ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Model explanation</p>
          <h3>Why the model scored this user the way it did</h3>
        </div>
      </div>

      <DistributionList
        title="Declared distribution"
        entries={selectedInference.declaredDistribution}
        labelForCohort={labelForCohort}
      />

      <DistributionList
        title="Behavior distribution"
        entries={selectedInference.behaviorDistribution}
        labelForCohort={labelForCohort}
      />

      {behaviorIsNonInformative ? (
        <div className="notice notice--warning">
          <strong>Behavior distribution is non-informative.</strong>
          <p>
            The normalized cohort bars are falling back to a spread shape, so read this as a
            placeholder until raw behavior strength and specificity rise.
          </p>
        </div>
      ) : null}

      <DistributionList
        title="Inverse behavior distribution"
        entries={selectedInference.inverseBehaviorDistribution}
        labelForCohort={labelForCohort}
      />

      <section className="diagnosis-card">
        <h4>Diagnosis reasons</h4>
        <ul className="diagnosis-list">
          {selectedInference.diagnosis.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="summary-inline">
          <span className="muted">
            Suggested cohort:{' '}
            {selectedInference.diagnosis.suggestedCohortId
              ? labelForCohort(selectedInference.diagnosis.suggestedCohortId)
              : 'none'}
          </span>
          <span className="muted">
            Suggested tags:{' '}
            {selectedInference.diagnosis.suggestedTags?.length
              ? selectedInference.diagnosis.suggestedTags.join(', ')
              : 'none'}
          </span>
        </div>
      </section>
    </div>
  ) : (
    <EmptyState title="No user selected" description="Choose a user to inspect declared and behavioral fit." />
  );

  const islandComparison = selectedUser && selectedComparisonCohort ? (
    <ReportTable
      columns={[
        {
          key: 'island',
          label: 'Island',
          render: (row: { island: Island; userRating: string; cohortRating: string; match: string }) => row.island.label
        },
        {
          key: 'user',
          label: 'User',
          render: (row) => row.userRating,
          align: 'center'
        },
        {
          key: 'cohort',
          label: 'Cohort',
          render: (row) => row.cohortRating,
          align: 'center'
        },
        {
          key: 'match',
          label: 'Match',
          render: (row) => row.match,
          align: 'center'
        }
      ]}
      rows={dataset.islands.map((island) => {
        const userRating = selectedUser.ratings[island.id] ?? null;
        const cohortRating = selectedComparisonCohort.ratings[island.id] ?? null;
        const match =
          userRating === null && cohortRating === null
            ? 'Both unrated'
            : userRating === null
              ? 'User unrated'
              : cohortRating === null
                ? 'Cohort unrated'
            : userRating === cohortRating
              ? 'Match'
              : 'Mismatch';

        return {
          island,
          userRating: formatRating(userRating),
          cohortRating: formatRating(cohortRating),
          match
        };
      })}
      getRowKey={(row) => row.island.id}
      onRowClick={(row) => setDrawerState({ type: 'island', id: row.island.id })}
      emptyTitle="No islands"
      emptyDescription="Increase the island count to compare ratings."
    />
  ) : (
    <EmptyState title="Select a user" description="Island comparison appears once a user is selected." />
  );

  const pseudoConsistentColumns = reportColumns;
  const pseudoInconsistentColumns = reportColumns;

  const pseudoConsistentRows = dataset.pseudoCohortAnalysis.topConsistentPseudoCohorts;
  const pseudoInconsistentRows = dataset.pseudoCohortAnalysis.topInconsistentPseudoCohorts;

  const openSelectionButton = (kind: Exclude<SelectionModalKind, null>, label: string) => (
    <button type="button" className="button" onClick={() => setModalKind(kind)}>
      {label}
    </button>
  );

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 1_000_000_000));
  };

  return (
    <main className="app-shell analyst-console">
      <header className="hero">
        <div className="hero__eyebrow-row">
          <p className="eyebrow">Wayfarer analyst console</p>
          <span className="hero__pill">Columbus debug engine</span>
        </div>
        <h1>Wayfarer</h1>
        <p className="subtitle">
          Analyst-first dashboard for inspecting synthetic cohorts, user signal, island fit, and
          pseudo-cohort reports at scale.
        </p>
      </header>

      <section className="control-strip" aria-label="Dashboard controls">
        <div className="control-strip__fields">
          <label className="control">
            <span>Seed</span>
            <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} min={0} step={1} />
          </label>
          <label className="control">
            <span>Users</span>
            <input
              type="number"
              value={numUsers}
              onChange={(event) => setNumUsers(Number(event.target.value))}
              min={1}
              max={400}
              step={1}
            />
          </label>
          <label className="control">
            <span>Islands</span>
            <input
              type="number"
              value={numIslands}
              onChange={(event) => setNumIslands(Number(event.target.value))}
              min={4}
              max={96}
              step={1}
            />
          </label>
          <label className="control">
            <span>Initial ratings</span>
            <input
              type="number"
              value={initialRatingsPerUser}
              onChange={(event) => setInitialRatingsPerUser(Number(event.target.value))}
              min={1}
              max={12}
              step={1}
            />
          </label>
          <label className="control">
            <span>Active users / turn</span>
            <input
              type="number"
              value={activeUsersPerTurn}
              onChange={(event) => setActiveUsersPerTurn(Number(event.target.value))}
              min={1}
              max={96}
              step={1}
            />
          </label>
          <label className="control">
            <span>Ratings / user</span>
            <input
              type="number"
              value={maxRatingsPerActiveUser}
              onChange={(event) => setMaxRatingsPerActiveUser(Number(event.target.value))}
              min={1}
              max={8}
              step={1}
            />
          </label>
          <label className="control">
            <span>Turn batch</span>
            <input
              type="number"
              value={turnBatchCount}
              onChange={(event) => setTurnBatchCount(Number(event.target.value))}
              min={1}
              max={20}
              step={1}
            />
          </label>
        </div>
        <div className="control-strip__actions">
          <button type="button" className="button" onClick={randomizeSeed}>
            Regenerate dataset
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              setSimulationState((state) =>
                advancePassiveTurn(state, {
                  activeUsersPerTurn,
                  maxRatingsPerActiveUser
                })
              )
            }
          >
            Take 1 Turn
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              setSimulationState((state) => {
                let next = state;

                for (let index = 0; index < turnBatchCount; index += 1) {
                  next = advancePassiveTurn(next, {
                    activeUsersPerTurn,
                    maxRatingsPerActiveUser
                  });
                }

                return next;
              })
            }
          >
            Take X Turns
          </button>
          <button type="button" className="button button--ghost" onClick={() => setSimulationState(initialSimulationState)}>
            Reset Simulation
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowDebug((value) => !value)}>
            {showDebug ? 'Hide debug' : 'Show debug'}
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowAbout((value) => !value)}>
            {showAbout ? 'Hide about' : 'About / Prior Art'}
          </button>
          {openSelectionButton('user', 'Select user')}
          {openSelectionButton('island', 'Select island')}
          {openSelectionButton('cohort', 'Select cohort')}
        </div>
      </section>

      <section className="summary-grid">
        <Panel title="Turn Summary" className="panel--full">
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Current turn" value={dataset.currentTurn} tone="accent" />
            <MetricCard label="Rating events" value={dataset.ratingEvents.length} />
            <MetricCard label="Ratings this turn" value={currentTurnSummary?.ratingsCreated ?? 0} />
            <MetricCard label="Active users this turn" value={currentTurnSummary?.activeUserIds.length ?? 0} />
            <MetricCard label="New islands rated" value={currentTurnSummary?.newlyRatedIslandIds.length ?? 0} />
          </div>
          <div className="summary-inline">
            {(dataset.turnHistory.slice(-3) ?? []).map((turn) => (
              <Badge key={turn.turn} tone="neutral">
                Turn {turn.turn}: {turn.ratingsCreated} ratings
              </Badge>
            ))}
          </div>
        </Panel>

        <Panel title="Population Summary" className="panel--full">
          <div className="metric-grid">
            <MetricCard label="Total users" value={populationSummary.totalUsers} tone="accent" />
            <MetricCard label="Seeded anchors" value={dataset.cohorts.length} />
            <MetricCard label="Generated users" value={populationSummary.generatedUsers} />
            <MetricCard label="Visible users" value={dataset.users.length} />
            <MetricCard label="Islands" value={dataset.islands.length} />
            <MetricCard label="Rating events" value={dataset.ratingEvents.length} />
            <MetricCard label="Current turn" value={dataset.currentTurn} tone="accent" />
            <MetricCard label="High signal users" value={populationSummary.highSignal} tone="success" />
            <MetricCard label="Retag candidates" value={populationSummary.retagCandidates} tone="warning" />
            <MetricCard label="Inverse profiles" value={populationSummary.inverseProfiles} tone="danger" />
            <MetricCard label="Unknown / noisy" value={populationSummary.noisyUsers} />
            <MetricCard label="Pseudo-cohort reports" value={populationSummary.pseudoReports} />
          </div>
          <div className="summary-inline">
            <ProgressBar
              value={populationSummary.totalUsers ? populationSummary.highSignal / populationSummary.totalUsers : 0}
              label="High-signal share"
              tone="success"
            />
          </div>
        </Panel>

        <Panel title="Selected User Summary">
          {selectedUser && selectedInference ? selectedUserSummary : <EmptyState title="No user selected" description="Open the user picker to inspect an individual user." />}
        </Panel>

        <Panel title="Selected Island Summary">
          {selectedIsland ? selectedIslandSummary : <EmptyState title="No island selected" description="Open the island picker to inspect an island." />}
        </Panel>

        <Panel title="Model Explanation" className="panel--wide">
          {modelExplanation}
        </Panel>

        <Panel title="Island Comparison" className="panel--wide">
          {islandComparison}
        </Panel>

        <Panel title="Pseudo-Cohort Reports" className="panel--wide">
          <div className="section-toolbar">
            <button type="button" className="button button--ghost" onClick={() => setModalKind('pseudo')}>
              Select report row
            </button>
          </div>
          <div className="report-section">
            <div className="report-section__column">
              <div className="section-heading">
                <h3>Top Consistent Pseudo-Cohorts</h3>
                <p>High agreement, meaningful evidence, and low known-cohort fit.</p>
              </div>
              <ReportTable
                columns={pseudoConsistentColumns}
                rows={pseudoConsistentRows}
                getRowKey={(row) => row.key}
                onRowClick={(row) => setDrawerState({ type: 'pseudo', key: row.key })}
                emptyTitle="No consistent pseudo-cohorts"
                emptyDescription="Increase user count or vary the generator seed."
              />
            </div>

            <div className="report-section__column">
              <div className="section-heading">
                <h3>Top Inconsistent Pseudo-Cohorts</h3>
                <p>Tag combinations whose members do not rate coherently.</p>
              </div>
              <ReportTable
                columns={pseudoInconsistentColumns}
                rows={pseudoInconsistentRows}
                getRowKey={(row) => row.key}
                onRowClick={(row) => setDrawerState({ type: 'pseudo', key: row.key })}
                emptyTitle="No inconsistent pseudo-cohorts"
                emptyDescription="Increase user count or vary the generator seed."
              />
            </div>
          </div>
        </Panel>

        {showDebug ? (
          <Panel title="Debug Data" className="panel--wide">
            {selectedUser && selectedInference ? (
              <div className="debug-grid">
                <MetricCard
                  label="Hidden seed"
                  value={selectedUser.hiddenSeedCohortId ? labelForCohort(selectedUser.hiddenSeedCohortId) : 'none'}
                  helper="Debug and validation only."
                />
                <MetricCard
                  label="Hidden tag alignment"
                  value={selectedUser.hiddenTagAlignment ?? 'n/a'}
                  helper="Debug and validation only."
                />
                <MetricCard
                  label="Hidden rating alignment"
                  value={selectedUser.hiddenRatingAlignment ?? 'n/a'}
                  helper="Debug and validation only."
                />
                <MetricCard
                  label="Hidden vs inferred"
                  value={
                    selectedUser.hiddenSeedCohortId === selectedInference.behaviorTop.cohortId
                      ? 'Recovered hidden seed'
                      : 'Different visible fit'
                  }
                  helper="Hidden data is not a model input."
                />
              </div>
            ) : (
              <EmptyState title="No debug data" description="Select a user to inspect hidden generation fields." />
            )}
          </Panel>
        ) : null}

      </section>

      <Modal open={showAbout} title="About / Prior Art" placement="top" onClose={() => setShowAbout(false)}>
        <div className="stack about-copy">
          <p>Wayfarer is adjacent to known work in trust-aware recommender systems.</p>
          <p>
            For example, Massa and Avesani&apos;s trust-aware collaborative filtering explored using propagated
            trust to improve recommender coverage while preserving prediction quality, especially when ordinary
            similarity matching becomes sparse. TrustSVD later incorporated explicit and implicit trust influence
            into a matrix-factorization recommender to address sparsity and cold-start problems.
          </p>
          <p>
            Those systems are useful landmarks. They suggest that trust and rating behavior can help recommender
            systems when ordinary rating coverage is thin.
          </p>
          <p>Wayfarer explores a different product-shaped version of that idea.</p>
          <p>
            Instead of using explicit social trust links or global user reputation, Wayfarer starts with trusted
            cohort anchors: seed reviewers chosen because they represent meaningful taste groups in a UGC
            ecosystem. Ordinary users earn cohort-local signal by rating known islands similarly to those anchors.
            Their later ratings then extend the effective reach of those anchors into sparse, under-reviewed
            content.
          </p>
          <p>
            So the propagated unit is not &ldquo;Alice trusts Bob&rdquo; or &ldquo;Bob is globally reputable.&rdquo;
            It is narrower:
          </p>
          <p className="about-copy__quote">Bob appears to be a reliable signal source for this cohort&apos;s taste.</p>
          <p>
            That makes Wayfarer an exploration of cohort-local trust propagation for UGC discovery, not a claim to
            have invented trust-aware recommendation from scratch.
          </p>
        </div>
      </Modal>

      <SelectionModal
        open={modalKind === 'user'}
        title="Select User"
        searchPlaceholder="Search users"
        options={selectedUserOptions}
        selectedId={selectedUserId}
        onSelect={(id) => {
          setSelectedUserId(id);
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <SelectionModal
        open={modalKind === 'island'}
        title="Select Island"
        searchPlaceholder="Search islands"
        options={selectedIslandOptions}
        selectedId={selectedIslandId}
        onSelect={(id) => {
          setSelectedIslandId(id);
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <SelectionModal
        open={modalKind === 'cohort'}
        title="Select Comparison Cohort"
        searchPlaceholder="Search cohorts"
        options={comparisonCohortOptions}
        selectedId={comparisonCohortId}
        onSelect={(id) => {
          setComparisonCohortId(id);
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <SelectionModal
        open={modalKind === 'pseudo'}
        title="Select Pseudo-Cohort Report"
        searchPlaceholder="Search report rows"
        options={pseudoReportOptions}
        selectedId={drawerState?.type === 'pseudo' ? drawerState.key : null}
        onSelect={(id) => {
          setDrawerState({ type: 'pseudo', key: id });
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <Drawer
        open={drawerState?.type === 'user'}
        title={drawerState?.type === 'user' ? `User detail: ${selectedUser?.label ?? drawerState.id}` : 'User detail'}
        onClose={() => setDrawerState(null)}
      >
        {selectedUserDetail}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'island'}
        title={drawerState?.type === 'island' ? `Island detail: ${selectedIsland?.label ?? drawerState.id}` : 'Island detail'}
        onClose={() => setDrawerState(null)}
      >
        {selectedIslandDetail}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'pseudo'}
        title={drawerState?.type === 'pseudo' ? 'Pseudo-cohort detail' : 'Pseudo-cohort detail'}
        onClose={() => setDrawerState(null)}
      >
        {pseudoDrawerContent}
      </Drawer>
    </main>
  );
}

