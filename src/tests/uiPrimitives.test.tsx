import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Modal } from '../ui/components/Modal';
import { Drawer } from '../ui/components/Drawer';

describe('UI primitives', () => {
  it('renders a modal shell with a close button', () => {
    const html = renderToString(
      <Modal open title="Select User" onClose={() => undefined}>
        <p>Modal content</p>
      </Modal>
    );

    expect(html).toContain('Select User');
    expect(html).toContain('Close');
    expect(html).toContain('Modal content');
  });

  it('renders a drawer shell with a close button', () => {
    const html = renderToString(
      <Drawer open title="User Details" onClose={() => undefined}>
        <p>Drawer content</p>
      </Drawer>
    );

    expect(html).toContain('User Details');
    expect(html).toContain('Close');
    expect(html).toContain('Drawer content');
  });
});
