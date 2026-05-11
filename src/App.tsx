import { Panel } from './ui/components/Panel';

const sections = [
  {
    title: 'Users',
    body: 'Seeded meta-moderators and generated users will appear here.'
  },
  {
    title: 'Island Ratings',
    body: 'Selected-user island ratings and comparisons will appear here.'
  },
  {
    title: 'Model Output',
    body: 'Declared fit, behavior fit, signal, and diagnosis will appear here.'
  },
  {
    title: 'Debug',
    body: 'Hidden generation metadata will be separated from model outputs here.'
  },
  {
    title: 'Pseudo-Cohorts',
    body: 'Analyst-facing cohort reports will appear here later.'
  }
] as const;

export default function App() {
  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Wayfarer scaffold</p>
        <h1>Wayfarer</h1>
        <p className="subtitle">
          Placeholder dashboard for the cohort-aware discovery prototype.
        </p>
      </header>

      <section className="dashboard-grid" aria-label="Wayfarer dashboard panels">
        {sections.map((section) => (
          <Panel key={section.title} title={section.title}>
            <p>{section.body}</p>
          </Panel>
        ))}
      </section>
    </main>
  );
}
