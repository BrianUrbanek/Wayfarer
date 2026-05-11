import { useMemo, useState } from 'react';
import { Modal } from './Modal.js';
import { EmptyState } from './EmptyState.js';

export interface SelectionOption {
  id: string;
  label: string;
  description?: string;
  badge?: string;
}

interface SelectionModalProps {
  open: boolean;
  title: string;
  searchPlaceholder: string;
  options: SelectionOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function SelectionModal({
  open,
  title,
  searchPlaceholder,
  options,
  selectedId,
  onSelect,
  onClose
}: SelectionModalProps) {
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const searchable = [option.label, option.description ?? '', option.badge ?? '']
        .join(' ')
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [options, query]);

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="selection-modal">
        <input
          className="selection-modal__search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
        />

        <div className="selection-modal__list">
          {filteredOptions.length === 0 ? (
            <EmptyState title="No matches" description="Try a different search term." />
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`selection-modal__option ${selectedId === option.id ? 'selection-modal__option--selected' : ''}`}
                onClick={() => onSelect(option.id)}
              >
                <div className="selection-modal__option-main">
                  <strong>{option.label}</strong>
                  {option.badge ? <span className="badge badge--neutral">{option.badge}</span> : null}
                </div>
                {option.description ? <p>{option.description}</p> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
