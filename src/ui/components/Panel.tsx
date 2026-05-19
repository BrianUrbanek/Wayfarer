import type { PropsWithChildren } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  className?: string;
  hideTitle?: boolean;
}

export function Panel({ title, children, className, hideTitle = false }: PanelProps) {
  return (
    <section className={`panel${className ? ` ${className}` : ''}`}>
      <h2 className={hideTitle ? 'sr-only' : undefined}>{title}</h2>
      {children}
    </section>
  );
}
