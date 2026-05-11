import type { CohortAnchor, User } from '../../model/types.js';

interface UserListPanelProps {
  cohorts: CohortAnchor[];
  users: User[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
}

function tagSummary(tags: readonly string[]): string {
  return tags.join(' · ');
}

export function UserListPanel({ cohorts, users, selectedUserId, onSelectUser }: UserListPanelProps) {
  return (
    <div className="stack">
      <section className="stack__section">
        <div className="section-heading">
          <h3>Seeded Meta-Moderators</h3>
          <p>Analyst anchors used by the model as known cohort reference points.</p>
        </div>
        <ul className="card-list">
          {cohorts.map((cohort) => (
            <li key={cohort.id} className="card card--subtle">
              <div className="card__title-row">
                <strong>{cohort.label}</strong>
                <span className="pill pill--muted">seeded</span>
              </div>
              <div className="chip-row">
                {cohort.tags.map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="stack__section">
        <div className="section-heading">
          <h3>Generated Users</h3>
          <p>Click a user to update the model output, ratings view, and debug details.</p>
        </div>
        <ul className="card-list">
          {users.map((user) => {
            const isSelected = user.id === selectedUserId;

            return (
              <li key={user.id}>
                <button
                  type="button"
                  className={`user-card ${isSelected ? 'user-card--selected' : ''}`}
                  onClick={() => onSelectUser(user.id)}
                >
                  <div className="card__title-row">
                    <strong>{user.label}</strong>
                    <span className="pill">user</span>
                  </div>
                  <p className="muted">{tagSummary(user.declaredTags)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
