import { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Badge } from './Badge';
import {
  CONCEPT_PRIMER_MARKDOWN,
  GLOSSARY_TERMS,
  type GlossaryImplementedStatus,
  type GlossaryScope
} from '../glossary';

function scopeLabel(scope: GlossaryScope): string {
  switch (scope) {
    case 'player-facing':
      return 'Player-facing';
    case 'analyst-facing':
      return 'Analyst-facing';
    case 'internal':
      return 'Internal';
    case 'future-facing':
      return 'Future-facing';
    default:
      return scope;
  }
}

function statusTone(status: GlossaryImplementedStatus): 'success' | 'warning' | 'neutral' {
  switch (status) {
    case 'implemented':
      return 'success';
    case 'partial':
      return 'warning';
    case 'future':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function statusLabel(status: GlossaryImplementedStatus): string {
  switch (status) {
    case 'implemented':
      return 'Implemented';
    case 'partial':
      return 'Partial';
    case 'future':
      return 'Future';
    default:
      return status;
  }
}

export function AboutGlossaryContent() {
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const termRefs = useRef<Partial<Record<string, HTMLTableRowElement | null>>>({});

  const glossaryOptions = useMemo(() => GLOSSARY_TERMS, []);

  const handleJumpToDefinition = (nextTermId: string) => {
    setSelectedTermId(nextTermId);

    const target = termRefs.current[nextTermId];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.focus();
  };

  return (
    <div className="stack about-copy">
      <section className="about-copy__section">
        <h3>Concept Primer</h3>
        <div className="about-copy__primer prose">
          <ReactMarkdown>{CONCEPT_PRIMER_MARKDOWN}</ReactMarkdown>
        </div>
      </section>

      <section className="about-copy__section" aria-label="Glossary">
        <h3>Glossary</h3>
        <p className="muted">Typed semantic checksum for core Wayfarer terms.</p>
        <div className="about-copy__jump glossary-jump">
          <label htmlFor="glossary-jump" className="about-copy__jump-label">
            Jump to definition
          </label>
          <select
            id="glossary-jump"
            className="about-copy__jump-select"
            value={selectedTermId}
            onChange={(event) => handleJumpToDefinition(event.target.value)}
          >
            <option value="">Select a term...</option>
            {glossaryOptions.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term}
              </option>
            ))}
          </select>
        </div>
        <div className="report-table-wrap about-copy__glossary-wrap">
          <table className="report-table about-copy__glossary" aria-label="Wayfarer glossary">
            <thead>
              <tr>
                <th>Term</th>
                <th>Short definition</th>
                <th>Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {GLOSSARY_TERMS.map((term) => (
                <tr
                  key={term.id}
                  id={term.id}
                  ref={(node) => {
                    termRefs.current[term.id] = node;
                  }}
                  tabIndex={-1}
                  aria-label={term.term}
                  className={selectedTermId === term.id ? 'about-copy__glossary-row about-copy__glossary-row--active' : 'about-copy__glossary-row'}
                >
                  <td>
                    <div className="table-cell-stack">
                      <strong>{term.term}</strong>
                      <span className="muted">{term.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-stack">
                      <span>{term.shortDefinition}</span>
                      <span className="muted">{term.fullDefinition}</span>
                    </div>
                  </td>
                  <td>
                    <Badge tone="accent">{scopeLabel(term.scope)}</Badge>
                  </td>
                  <td>
                    <Badge tone={statusTone(term.implementedStatus)}>{statusLabel(term.implementedStatus)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
