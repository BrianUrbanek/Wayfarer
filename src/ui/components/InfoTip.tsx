import { Tooltip } from './Tooltip';

interface InfoTipProps {
  label: string;
  text: string;
}

export function InfoTip({ label, text }: InfoTipProps) {
  return (
    <Tooltip label={label} ariaLabel={label} icon="?" activation="click" className="info-tip__tooltip">
      <section className="system-health-popover__section">
        <h5>About</h5>
        <p>{text}</p>
      </section>
    </Tooltip>
  );
}
