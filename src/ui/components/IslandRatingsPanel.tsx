import type { CohortAnchor, Island, MaybeRating, User } from '../../model/types.js';

interface IslandRatingsPanelProps {
  user: User;
  comparisonCohort: CohortAnchor | null;
  islands: Island[];
}

function ratingLabel(rating: MaybeRating): string {
  if (rating === 1) return '+1';
  if (rating === 0) return '0';
  if (rating === -1) return '-1';
  return '—';
}

function ratingTone(rating: MaybeRating): string {
  if (rating === 1) return 'rating rating--up';
  if (rating === 0) return 'rating rating--meh';
  if (rating === -1) return 'rating rating--down';
  return 'rating rating--missing';
}

export function IslandRatingsPanel({
  user,
  comparisonCohort,
  islands
}: IslandRatingsPanelProps) {
  return (
    <section className="comparison-table">
      <div className="section-heading">
        <h3>Island Ratings</h3>
        <p>
          Comparing {user.label} against{' '}
          {comparisonCohort ? comparisonCohort.label : 'no selected cohort'}.
        </p>
      </div>

      <div className="comparison-table__legend">
        <span className="pill">user</span>
        <span className="pill pill--muted">cohort</span>
        <span className="muted">0 = meh, null = not rated</span>
      </div>

      <div className="ratings-grid">
        {islands.map((island) => {
          const userRating = user.ratings[island.id] ?? null;
          const cohortRating = comparisonCohort?.ratings[island.id] ?? null;
          const matchState =
            userRating === null || cohortRating === null
              ? 'No overlap'
              : userRating === cohortRating
                ? 'Match'
                : 'Mismatch';

          return (
            <article key={island.id} className="rating-row">
              <div className="rating-row__label">{island.label}</div>
              <div className="rating-row__cells">
                <span className={ratingTone(userRating)}>{ratingLabel(userRating)}</span>
                <span className={ratingTone(cohortRating)}>{ratingLabel(cohortRating)}</span>
                <span className="rating-row__match">{matchState}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
