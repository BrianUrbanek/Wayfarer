import type { PropsWithChildren } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  className?: string;
}

export function Panel({ title, children, className }: PanelProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
