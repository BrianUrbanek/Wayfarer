import { useState } from 'react';

interface FormulaTipProps {
  label: string;
  formula: string;
  inputs?: string;
  interpretation?: string;
}

export function FormulaTip({ label, formula, inputs, interpretation }: FormulaTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="formula-tip">
      <button
        type="button"
        className="system-health-affordance formula-tip__button"
        aria-label={`Open formula for ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        ƒ
      </button>
      {open ? (
        <div className="system-health-popover formula-tip__popover" role="dialog" aria-label={`${label} formula`}>
          <section className="system-health-popover__section">
            <h5>Formula</h5>
            <p>{formula}</p>
          </section>
          {inputs ? (
            <section className="system-health-popover__section">
              <h5>Inputs</h5>
              <p>{inputs}</p>
            </section>
          ) : null}
          {interpretation ? (
            <section className="system-health-popover__section">
              <h5>Interpretation</h5>
              <p>{interpretation}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
