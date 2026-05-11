interface ProgressBarProps {
  value: number;
  label?: string;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function ProgressBar({ value, label, tone = 'accent' }: ProgressBarProps) {
  const percent = Math.round(clamp(value) * 100);

  return (
    <div className="progress-bar">
      {label ? <div className="progress-bar__label">{label}</div> : null}
      <div className={`progress-bar__track progress-bar__track--${tone}`}>
        <div className="progress-bar__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-bar__value">{percent}%</div>
    </div>
  );
}
