import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Tray } from '../ui/components/Tray';

describe('tray collapse rail', () => {
  it('renders a visible re-expand control in the collapsed left rail', () => {
    const html = renderToString(
      <Tray collapsed title="Guided paths" side="left" onToggle={() => {}}>
        <div>Body</div>
      </Tray>
    );

    expect(html).toContain('tray--collapsed');
    expect(html).toContain('tray__toggle');
    expect(html).toContain('Guided paths');
  });
});
