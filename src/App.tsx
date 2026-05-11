import { useEffect, useMemo, useState } from 'react';
import { Panel } from './ui/components/Panel';
import { UserListPanel } from './ui/components/UserListPanel';
import { IslandRatingsPanel } from './ui/components/IslandRatingsPanel';
import { ModelOutputPanel } from './ui/components/ModelOutputPanel';
import { DebugPanel } from './ui/components/DebugPanel';
import { PseudoCohortPanel } from './ui/components/PseudoCohortPanel';
import { DEFAULT_TAGS } from './data/defaultTags';
import { createDefaultCohorts } from './data/defaultCohorts';
import { generateColumbusDataset } from './generator/columbusGenerator';
import { computeInference } from './model/inference';
import { analyzePseudoCohorts } from './model/pseudoCohorts';
import type { CohortAnchor } from './model/types';

const INITIAL_CONFIG = {
  seed: 48291,
  numUsers: 12,
  numIslands: 18
};

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

export default function App() {
  const [seed, setSeed] = useState(INITIAL_CONFIG.seed);
  const [numUsers, setNumUsers] = useState(INITIAL_CONFIG.numUsers);
  const [numIslands, setNumIslands] = useState(INITIAL_CONFIG.numIslands);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [comparisonCohortId, setComparisonCohortId] = useState<string>('auto');
  const [showDebug, setShowDebug] = useState(true);

  const dataset = useMemo(() => buildDataset(seed, numUsers, numIslands), [seed, numUsers, numIslands]);

  const inferenceByUserId = useMemo(() => {
    return new Map(
      dataset.users.map((user) => [
        user.id,
        computeInference(user, dataset.cohorts, dataset.allTags, dataset.islands)
      ])
    );
  }, [dataset]);

  const pseudoCohorts = useMemo(
    () => analyzePseudoCohorts(dataset.users, inferenceByUserId),
    [dataset.users, inferenceByUserId]
  );

  const selectedUser = useMemo(() => {
    return dataset.users.find((user) => user.id === selectedUserId) ?? dataset.users[0] ?? null;
  }, [dataset.users, selectedUserId]);

  const selectedInference = selectedUser ? inferenceByUserId.get(selectedUser.id) : undefined;

  useEffect(() => {
    if (!dataset.users.length) {
      setSelectedUserId('');
      return;
    }

    if (!selectedUser || selectedUser.id !== selectedUserId) {
      setSelectedUserId(dataset.users[0].id);
    }
  }, [dataset.users, selectedUser, selectedUserId]);

  const labelForCohort = useMemo(() => labelForCohortFactory(dataset.cohorts), [dataset.cohorts]);

  const comparisonCohortIdResolved = useMemo(() => {
    if (comparisonCohortId !== 'auto') {
      return comparisonCohortId;
    }

    return (
      selectedInference?.behaviorTop.cohortId ??
      selectedInference?.declaredTop.cohortId ??
      dataset.cohorts[0]?.id ??
      null
    );
  }, [comparisonCohortId, dataset.cohorts, selectedInference]);

  const comparisonCohort = useMemo(() => {
    if (comparisonCohortIdResolved === null) {
      return null;
    }

    return dataset.cohorts.find((cohort) => cohort.id === comparisonCohortIdResolved) ?? null;
  }, [comparisonCohortIdResolved, dataset.cohorts]);

  const hiddenClassificationLabel = useMemo(() => {
    if (!selectedUser || !selectedInference) {
      return 'No user selected';
    }

    const targetCohort = selectedInference.behaviorTop.cohortId
      ? labelForCohort(selectedInference.behaviorTop.cohortId)
      : 'none';

    if (!selectedUser.hiddenSeedCohortId) {
      return 'No hidden seed assigned';
    }

    if (selectedUser.hiddenSeedCohortId === selectedInference.behaviorTop.cohortId) {
      return 'Recovered hidden seed';
    }

    if (
      selectedInference.diagnosis.type === 'MISMATCH_RETAG' ||
      selectedInference.diagnosis.type === 'HIGH_SIGNAL'
    ) {
      return `Visible behavior maps to ${targetCohort} instead of the hidden seed`;
    }

    if (selectedInference.diagnosis.type === 'INVERSE_PROFILE') {
      return `Strong inverse pattern relative to ${labelForCohort(selectedInference.inverseTop.cohortId)}`;
    }

    return `Debug-only relation to ${labelForCohort(selectedUser.hiddenSeedCohortId)}`;
  }, [labelForCohort, selectedInference, selectedUser]);

  const hiddenSeedLabel = selectedUser?.hiddenSeedCohortId
    ? labelForCohort(selectedUser.hiddenSeedCohortId)
    : null;

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 1_000_000_000));
  };

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero__eyebrow-row">
          <p className="eyebrow">Wayfarer explainability dashboard</p>
          <span className="hero__pill">Columbus debug engine</span>
        </div>
        <h1>Wayfarer</h1>
        <p className="subtitle">
          A cohort-aware discovery console that surfaces visible tags, observed ratings, diagnosis, and
          analyst-facing pseudo-cohort reports without exposing hidden synthetic metadata to the model.
        </p>
      </header>

      <section className="control-bar" aria-label="Dataset controls">
        <label className="control">
          <span>Seed</span>
          <input
            type="number"
            value={seed}
            onChange={(event) => setSeed(Number(event.target.value))}
            min={0}
            step={1}
          />
        </label>

        <label className="control">
          <span>Users</span>
          <input
            type="number"
            value={numUsers}
            onChange={(event) => setNumUsers(Number(event.target.value))}
            min={1}
            max={64}
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
            max={48}
            step={1}
          />
        </label>

        <label className="control control--wide">
          <span>Comparison cohort</span>
          <select
            value={comparisonCohortId}
            onChange={(event) => setComparisonCohortId(event.target.value)}
          >
            <option value="auto">Behavior top</option>
            {dataset.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="button" onClick={randomizeSeed}>
          Regenerate dataset
        </button>

        <button type="button" className="button button--ghost" onClick={() => setShowDebug((value) => !value)}>
          {showDebug ? 'Hide debug panel' : 'Show debug panel'}
        </button>

        <div className="control-bar__meta">
          <span>{dataset.cohorts.length} seeded anchors</span>
          <span>{dataset.users.length} generated users</span>
          <span>{dataset.islands.length} islands</span>
        </div>
      </section>

      <section className="dashboard-grid" aria-label="Wayfarer dashboard">
        <Panel title="Users" className="panel--users">
          {selectedUser ? (
            <UserListPanel
              cohorts={dataset.cohorts}
              users={dataset.users}
              selectedUserId={selectedUser.id}
              onSelectUser={setSelectedUserId}
            />
          ) : (
            <p className="muted">No users available.</p>
          )}
        </Panel>

        <Panel title="Island Ratings" className="panel--ratings">
          {selectedUser && comparisonCohort ? (
            <IslandRatingsPanel
              user={selectedUser}
              comparisonCohort={comparisonCohort}
              islands={dataset.islands}
            />
          ) : (
            <p className="muted">Select a user to see island-by-island rating comparisons.</p>
          )}
        </Panel>

        <Panel title="Model Output" className="panel--model">
          {selectedUser && selectedInference ? (
            <ModelOutputPanel
              inference={selectedInference}
              cohorts={dataset.cohorts}
              labelForCohort={labelForCohort}
            />
          ) : (
            <p className="muted">Select a user to inspect declared, behavioral, and inverse signal.</p>
          )}
        </Panel>

        {showDebug ? (
          <Panel title="Debug" className="panel--debug">
            {selectedUser && selectedInference ? (
              <DebugPanel
                user={selectedUser}
                inference={selectedInference}
                hiddenSeedLabel={hiddenSeedLabel}
                hiddenClassification={hiddenClassificationLabel}
                showHidden={showDebug}
              />
            ) : (
              <p className="muted">No user selected.</p>
            )}
          </Panel>
        ) : null}

        <Panel title="Pseudo-Cohorts" className="panel--pseudo panel--full">
          <PseudoCohortPanel analysis={pseudoCohorts} />
        </Panel>
      </section>
    </main>
  );
}
