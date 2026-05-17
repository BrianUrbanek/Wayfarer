interface AffinityBarRow {
  label: string;
  affinity: number;
  confidence: number;
  evidence: number;
}

interface DivergingAffinityBarsProps {
  rows: AffinityBarRow[];
  formatSigned: (value: number) => string;
  formatPercent: (value: number) => string;
  formatDecimal: (value: number, digits?: number) => string;
}

export function DivergingAffinityBars({ rows, formatSigned, formatPercent, formatDecimal }: DivergingAffinityBarsProps) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.affinity)), 0.001);

  return (
    <div className="diverging-affinity" role="img" aria-label="Directional island audience affinity by cohort">
      <div className="diverging-affinity__axis">
        <span>Negative fit</span>
        <span>0</span>
        <span>Positive fit</span>
      </div>
      {rows.map((row) => {
        const width = (Math.abs(row.affinity) / maxAbs) * 100;
        const isPositive = row.affinity >= 0;
        return (
          <div key={row.label} className="diverging-affinity__row">
            <span className="diverging-affinity__label">{row.label}</span>
            <div className="diverging-affinity__track">
              <div className={`diverging-affinity__half ${isPositive ? 'is-positive' : 'is-negative'}`}>
                <div className={`diverging-affinity__bar ${isPositive ? 'is-positive' : 'is-negative'}`} style={{ width: `${width}%` }} />
              </div>
            </div>
            <span className="diverging-affinity__meta">
              {isPositive ? 'Positive' : 'Negative'} {formatSigned(row.affinity)} - conf {formatPercent(row.confidence)} - ev {formatDecimal(row.evidence)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
