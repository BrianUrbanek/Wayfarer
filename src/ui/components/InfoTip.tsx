interface InfoTipProps {
  label: string;
  text: string;
}

export function InfoTip({ label, text }: InfoTipProps) {
  return (
    <button
      type="button"
      className="icon-button info-tip"
      aria-label={label}
      title={text}
    >
      ?
    </button>
  );
}
