import { Badge } from '../components/Badge';
import { MetricCard } from '../components/MetricCard';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import { FormulaTip } from '../components/FormulaTip';
import type { CohortAnchor } from '../../model/types';
import type { InferenceAnalysis } from '../../model/inference';
import type { RaterSignalProfile } from '../../model/raterSignal';
import type { UserSignalDiagnosisSummary } from '../userSignalDiagnosis';
import type { ReactNode } from 'react';

interface SignalRow {
  cohort: CohortAnchor;
  weight: number;
  evidence: number;
  similarity: { value: number; evidence: number; overlapCount: number };
}

interface SelectedUserSummaryProps {
  selectedUserLabel: string;
  declaredTags: string[];
  selectedInference: InferenceAnalysis;
  selectedPrimarySignal: UserSignalDiagnosisSummary | null;
  selectedInferenceDiagnosticsMessage?: string;
  selectedInferenceDiagnosticsType?: string;
  selectedRaterSignalProfile: RaterSignalProfile | null;
  declaredOverlapText: string;
  declaredObservedRelationshipText: string;
  behaviorReadText: string;
  inverseNotice: string;
  cohortLabel: (cohortId: string | null) => string;
  openUserPicker: () => void;
  pinCurrentUser: () => void;
  renderPrimarySignalTitle: (signal: UserSignalDiagnosisSummary | null) => string | null;
  signalRows: SignalRow[];
  signalColumns: ReportTableColumn<SignalRow>[];
  declaredDistributionChart: ReactNode;
  behaviorDistributionChart: ReactNode;
}

export function SelectedUserSummary(props: SelectedUserSummaryProps) {
  const { selectedUserLabel, declaredTags, selectedInference, selectedPrimarySignal, selectedInferenceDiagnosticsMessage, selectedInferenceDiagnosticsType, selectedRaterSignalProfile, declaredObservedRelationshipText, behaviorReadText, inverseNotice, cohortLabel, openUserPicker, pinCurrentUser, renderPrimarySignalTitle, signalRows, signalColumns, declaredDistributionChart, behaviorDistributionChart } = props;

  return (
    <div className="stack">
      <div className="summary-header">
        <div><p className="eyebrow">Selected user</p><h3>{selectedUserLabel}</h3></div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={pinCurrentUser}>Pin current user</button>
          <button type="button" className="button button--ghost" onClick={openUserPicker}>Choose user</button>
        </div>
      </div>
      <div className="badge-row">{declaredTags.map((tag) => <Badge key={tag} tone="accent">{tag}</Badge>)}</div>
      <div className="metric-grid">
        <MetricCard label="Declared vs observed fit" value={selectedInference.signalFit.toFixed(3)} helper="How closely declared tags and observed ratings align at the cohort level." tone="accent" />
        <MetricCard label="Rating Evidence" value={selectedInference.ratingEvidence.toFixed(3)} helper="How much sparse rating data supports this judgment?" tone="neutral" />
        <MetricCard label="Recommendation signal weight ƒ" value={selectedInference.effectiveSignal.toFixed(3)} helper="How strongly this player's ratings should influence routing decisions right now." tone="success" />
      </div>
      <p className="muted">{declaredObservedRelationshipText}</p>
      <div className="metric-grid metric-grid--compact">
        <MetricCard label="Behavior match strength ƒ" value={selectedInference.behaviorMatchStrength.toFixed(3)} helper="Strongest raw positive cohort fit before the distribution is normalized." />
        <MetricCard label="Behavior specificity ƒ" value={selectedInference.behaviorSpecificity.toFixed(3)} helper="How much the behavior distribution prefers one cohort over the runner-up." />
        <MetricCard label="Target agreement ƒ" value={selectedInference.targetAlignment.ratedCount > 0 ? `${selectedInference.targetAlignment.agreementCount}/${selectedInference.targetAlignment.ratedCount}` : 'No evidence'} helper={selectedInference.targetAlignment.cohortId ? `${Math.round(selectedInference.targetAlignment.agreementRate * 100)}% agreement with ${cohortLabel(selectedInference.targetAlignment.cohortId)} reference ratings.` : 'No reference cohort available for direct target agreement yet.'} tone={selectedInference.targetAlignment.agreementRate >= 0.8 ? 'success' : selectedInference.targetAlignment.agreementRate >= 0.5 ? 'accent' : 'warning'} />
        <MetricCard label="Cohort separability ƒ" value={`${Math.round(selectedInference.cohortSeparability.topGap * 100)} pts`} helper={selectedInference.cohortSeparability.message} tone={selectedInference.cohortSeparability.label === 'high' ? 'success' : selectedInference.cohortSeparability.label === 'moderate' ? 'accent' : 'warning'} />
      </div>
      <div className="report-section">
        <div className="report-section__column"><div className="section-heading"><h3>Declared Tag Distribution <FormulaTip label="Declared distribution" formula="declared distribution share = cohort declared score / sum of positive declared scores" inputs="declared score uses declared tag overlap against each cohort tag set" interpretation="Distribution share is normalized mass, not an exact-match percent." /></h3><p>Top cohort: {cohortLabel(selectedInference.declaredTop.cohortId)}</p></div>{declaredDistributionChart}</div>
        <div className="report-section__column"><div className="section-heading"><h3>Observed Behavior Distribution <FormulaTip label="Behavior distribution" formula="behavior score = max(0, Pearson similarity) × evidence; share = cohort behavior score / sum of positive behavior scores" inputs="Pearson similarity and evidence are computed from rated-overlap islands." interpretation="Chart values are normalized distribution shares, not direct match percentages." /></h3><p>{behaviorReadText}</p></div>{behaviorDistributionChart}</div>
      </div>
      <div className="notice notice--subtle">
        <strong>{renderPrimarySignalTitle(selectedPrimarySignal) ?? 'Primary signal is still emerging.'}</strong>
        <p>{selectedPrimarySignal?.message ?? selectedInferenceDiagnosticsMessage}</p>
        <p className="muted">{inverseNotice}</p>
      </div>
      <section className="detail-block">
        <div className="section-heading"><h4>Rater signal profile <FormulaTip label="Rater signal" formula="cohort signal = max(0, Pearson similarity) × evidence; top behavioral signal = max cohort signal" inputs="Evidence comes from rated-overlap support (saturating overlap evidence)." interpretation="Higher signal means stronger positive cohort-local fit with enough overlap support." /></h4><p>Cohort-local signal only. No tag-level trust weights are calculated here.</p></div>
        <div className="metric-grid metric-grid--compact">
          <MetricCard label="Top behavioral signal ƒ" value={(selectedRaterSignalProfile?.overallSignal ?? 0).toFixed(3)} helper="Strongest cohort-local signal score." tone="accent" />
          <MetricCard label="Signal evidence ƒ" value={`${Math.round((selectedRaterSignalProfile?.signalEvidence ?? 0) * 100)}%`} helper="Evidence supporting the strongest positive cohort signal." />
          <MetricCard label="Top cohort" value={cohortLabel(selectedRaterSignalProfile?.topCohortId ?? null)} helper="The cohort with the strongest visible behavioral signal." tone="success" />
        </div>
        <div className="summary-inline"><span className="muted">Cohort signal table</span><FormulaTip label="Cohort signal table" formula="Signal: max(0, Pearson similarity) × evidence; Evidence: overlap/(overlap+k); Similarity: Pearson correlation; Overlap: co-rated island count." /></div><ReportTable columns={signalColumns} rows={signalRows} getRowKey={(row) => row.cohort.id} emptyTitle="No signal profile" emptyDescription="This user has not yet accumulated enough overlap to form cohort-local signal." />
      </section>
      <div className="summary-inline">
        <Badge tone={selectedPrimarySignal?.kind === 'positive' ? 'success' : selectedPrimarySignal?.kind === 'inverse' ? 'danger' : selectedPrimarySignal?.kind === 'mismatch' ? 'warning' : 'neutral'}>{renderPrimarySignalTitle(selectedPrimarySignal) ?? selectedInferenceDiagnosticsType ?? 'AMBIGUOUS'}</Badge>
        <span className="muted">{selectedPrimarySignal?.message ?? selectedInferenceDiagnosticsMessage}</span>
      </div>
    </div>
  );
}

