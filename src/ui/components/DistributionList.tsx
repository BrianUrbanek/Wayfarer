import type { CohortMatch } from '../../model/types.js';

interface DistributionListProps {
  title: string;
  entries: CohortMatch[];
  labelForCohort: (cohortId: string | null) => string;
}

function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function DistributionList({ title, entries, labelForCohort }: DistributionListProps) {
  const maxScore = Math.max(...entries.map((entry) => entry.score), 0.0001);

  return (
    <section className="distribution-list" aria-label={title}>
      <div className="distribution-list__header">
        <h3>{title}</h3>
      </div>
      <ul className="distribution-list__items">
        {entries.map((entry) => (
          <li key={entry.cohortId ?? 'none'} className="distribution-list__item">
            <div className="distribution-list__row">
              <span className="distribution-list__label">{labelForCohort(entry.cohortId)}</span>
              <span className="distribution-list__score">{formatPercent(entry.score)}</span>
            </div>
            <div className="bar">
              <div
                className="bar__fill"
                style={{ width: `${Math.max(2, (entry.score / maxScore) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
