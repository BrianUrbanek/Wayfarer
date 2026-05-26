import { Tooltip } from './Tooltip';

interface FormulaTipProps {
  label: string;
  formula: string;
  inputs?: string;
  interpretation?: string;
}

export function FormulaTip({ label, formula, inputs, interpretation }: FormulaTipProps) {
  return (
    <Tooltip label={`${label} formula`} ariaLabel={`Open formula for ${label}`} icon="ƒ" activation="click" className="formula-tip">
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
    </Tooltip>
  );
}
