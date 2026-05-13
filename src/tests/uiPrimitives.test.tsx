import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CollapsiblePanel } from '../ui/components/CollapsiblePanel';
import { Drawer } from '../ui/components/Drawer';
import { Modal } from '../ui/components/Modal';

describe('UI primitives', () => {
  it('renders a modal shell when open', () => {
    const html = renderToString(
      <Modal open title="Select User" onClose={() => undefined}>
        <p>Modal content</p>
      </Modal>
    );

    expect(html).toContain('Select User');
    expect(html).toContain('Close');
    expect(html).toContain('Modal content');
  });

  it('renders nothing when a modal is closed', () => {
    const html = renderToString(
      <Modal open={false} title="Select User" onClose={() => undefined}>
        <p>Modal content</p>
      </Modal>
    );

    expect(html).toBe('');
  });

  it('renders a drawer shell when open', () => {
    const html = renderToString(
      <Drawer open title="User Details" onClose={() => undefined}>
        <p>Drawer content</p>
      </Drawer>
    );

    expect(html).toContain('User Details');
    expect(html).toContain('Close');
    expect(html).toContain('Drawer content');
  });

  it('renders nothing when a drawer is closed', () => {
    const html = renderToString(
      <Drawer open={false} title="User Details" onClose={() => undefined}>
        <p>Drawer content</p>
      </Drawer>
    );

    expect(html).toBe('');
  });

  it('renders a compact collapsible panel when expanded or collapsed', () => {
    const expanded = renderToString(
      <CollapsiblePanel title="Simulation setup" collapsed={false} onToggle={() => undefined} description="Stable settings">
        <p>Panel content</p>
      </CollapsiblePanel>
    );
    const collapsed = renderToString(
      <CollapsiblePanel title="Simulation setup" collapsed onToggle={() => undefined} description="Stable settings">
        <p>Panel content</p>
      </CollapsiblePanel>
    );

    expect(expanded).toContain('Simulation setup');
    expect(expanded).toContain('Stable settings');
    expect(expanded).toContain('Panel content');
    expect(expanded).toContain('Collapse Simulation setup');
    expect(collapsed).toContain('Simulation setup');
    expect(collapsed).toContain('Stable settings');
    expect(collapsed).toContain('Expand Simulation setup');
    expect(collapsed).not.toContain('Panel content');
  });
});
