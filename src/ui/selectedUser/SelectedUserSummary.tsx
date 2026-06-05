import { Badge } from '../components/Badge';
import { MetricCard } from '../components/MetricCard';
import { FormulaTip } from '../components/FormulaTip';
import type { InferenceAnalysis } from '../../model/inference';
import type { UserSignalDiagnosisSummary } from '../userSignalDiagnosis';
import type { ReactNode } from 'react';

interface SelectedUserSummaryProps {
  selectedUserLabel: string;
  declaredTags: string[];
  selectedInference: InferenceAnalysis;
  selectedPrimarySignal: UserSignalDiagnosisSummary | null;
  selectedInferenceDiagnosticsMessage?: string;
  selectedInferenceDiagnosticsType?: string;
  declaredOverlapText: string;
  declaredObservedRelationshipText: string;
  behaviorReadText: string;
  inverseNotice: string;
  cohortLabel: (cohortId: string | null) => string;
  openUserPicker: () => void;
  pinCurrentUser: () => void;
  renderPrimarySignalTitle: (signal: UserSignalDiagnosisSummary | null) => string | null;
  declaredDistributionChart: ReactNode;
  behaviorDistributionChart: ReactNode;
}

export function SelectedUserSummary(props: SelectedUserSummaryProps) {
  const {
    selectedUserLabel,
    declaredTags,
    selectedInference,
    selectedPrimarySignal,
    selectedInferenceDiagnosticsMessage,
    selectedInferenceDiagnosticsType,
    declaredOverlapText,
    declaredObservedRelationshipText,
    behaviorReadText,
    inverseNotice,
    cohortLabel,
    openUserPicker,
    pinCurrentUser,
    renderPrimarySignalTitle,
    declaredDistributionChart,
    behaviorDistributionChart
  } = props;

  return (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Selected user</p>
          <h3>{selectedUserLabel}</h3>
        </div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={pinCurrentUser}>
            Pin current user
          </button>
          <button type="button" className="button button--ghost" onClick={openUserPicker}>
            Choose user
          </button>
        </div>
      </div>
      <div className="badge-row">
        {declaredTags.map((tag) => (
          <Badge key={tag} tone="accent">
            {tag}
          </Badge>
        ))}
      </div>
      <section className="detail-block">
        <h4>Preference read</h4>
        <div className="metric-grid">
          <MetricCard
            label="Declared vs observed fit"
            value={selectedInference.signalFit.toFixed(3)}
            helper="How closely declared tags and observed ratings align at the cohort level."
            tone="accent"
          />
          <MetricCard
            label="Rating evidence"
            value={selectedInference.ratingEvidence.toFixed(3)}
            helper="How much sparse rating data supports this judgment?"
            tone="neutral"
          />
        </div>
        <p className="muted">{declaredObservedRelationshipText}</p>
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
          <MetricCard
            label="Target agreement"
            value={selectedInference.targetAlignment.ratedCount > 0 ? `${selectedInference.targetAlignment.agreementCount}/${selectedInference.targetAlignment.ratedCount}` : 'No evidence'}
            helper={selectedInference.targetAlignment.cohortId ? `${Math.round(selectedInference.targetAlignment.agreementRate * 100)}% agreement with ${cohortLabel(selectedInference.targetAlignment.cohortId)} reference ratings.` : 'No reference cohort available for direct target agreement yet.'}
            tone={selectedInference.targetAlignment.agreementRate >= 0.8 ? 'success' : selectedInference.targetAlignment.agreementRate >= 0.5 ? 'accent' : 'warning'}
          />
          <MetricCard
            label="Cohort separability"
            value={`${Math.round(selectedInference.cohortSeparability.topGap * 100)} pts`}
            helper={selectedInference.cohortSeparability.message}
            tone={selectedInference.cohortSeparability.label === 'high' ? 'success' : selectedInference.cohortSeparability.label === 'moderate' ? 'accent' : 'warning'}
          />
        </div>
      </section>
      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>
              Declared Tag Distribution{' '}
              <FormulaTip
                label="Declared distribution"
                formula="declared distribution share = cohort declared score / sum of positive declared scores"
                inputs="declared score uses declared tag overlap against each cohort tag set"
                interpretation="Distribution share is normalized mass, not an exact-match percent."
              />
            </h3>
            <p>Top cohort: {cohortLabel(selectedInference.declaredTop.cohortId)}</p>
            <p className="muted">{declaredOverlapText}</p>
          </div>
          {declaredDistributionChart}
        </div>
        <div className="report-section__column">
          <div className="section-heading">
            <h3>
              Observed Behavior Distribution{' '}
              <FormulaTip
                label="Behavior distribution"
                formula="behavior score = max(0), Pearson similarity × evidence; share = cohort behavior score / sum of positive behavior scores"
                inputs="Pearson similarity and evidence are computed from rated-overlap islands."
                interpretation="Chart values are normalized distribution shares, not direct match percentages."
              />
            </h3>
            <p>{behaviorReadText}</p>
          </div>
          {behaviorDistributionChart}
        </div>
      </div>
      <div className="notice notice--subtle">
        <strong>{renderPrimarySignalTitle(selectedPrimarySignal) ?? 'Primary signal is still emerging.'}</strong>
        <p>{selectedPrimarySignal?.message ?? selectedInferenceDiagnosticsMessage}</p>
        <p className="muted">{inverseNotice}</p>
      </div>
      <section className="detail-block">
        <div className="section-heading">
          <h4>Signal-source read</h4>
          <p>
            Hidden for replacement. The previous rater-signal and Discovery Signal surfaces used legacy cohort-similarity and stored-confidence proxy math.
          </p>
        </div>
        <div className="notice notice--subtle">
          <strong>Replacement target</strong>
          <p>
            Restore this section only when it can consume modeling-core source authority, lane-local signal usefulness, signal RD, volatility, proxy role, and provenance.
          </p>
        </div>
      </section>
      <div className="summary-inline">
        <Badge
          tone={
            selectedPrimarySignal?.kind === 'positive'
              ? 'success'
              : selectedPrimarySignal?.kind === 'inverse'
                ? 'danger'
                : selectedPrimarySignal?.kind === 'mismatch'
                  ? 'warning'
                  : 'neutral'
          }
        >
          {renderPrimarySignalTitle(selectedPrimarySignal) ?? selectedInferenceDiagnosticsType ?? 'AMBIGUOUS'}
        </Badge>
        <span className="muted">
          {selectedPrimarySignal?.kind === 'mismatch'
            ? 'High behavioral reliability with declared/observed mismatch indicates a classification opportunity, not low-value data.'
            : selectedPrimarySignal?.message ?? selectedInferenceDiagnosticsMessage}
        </span>
      </div>
      <section className="detail-block">
        <div className="section-heading">
          <h4>Expert provenance</h4>
          <p>Seed, seed-proxy, and source-authority values remain explicit debug checksums unless an active modeling trace is available.</p>
        </div>
        <p className="muted">{selectedInferenceDiagnosticsMessage ?? 'No additional provenance available.'}</p>
      </section>
    </div>
  );
}
