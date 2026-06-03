import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ModelingLabPanel } from '../ui/modelingLab/ModelingLabPanel';

describe('modeling lab panel', () => {
  it('renders the first analyst-facing modeling lab slice', () => {
    const html = renderToString(<ModelingLabPanel />);

    expect(html).toContain('Modeling Lab');
    expect(html).toContain('seed-proxy-scenario-matrix');
    expect(html).toContain('Scenario validation');
    expect(html).toContain('Matrix Bob');
    expect(html).toContain('seedProxy');
    expect(html).toContain('ORACLE / TEST TRUTH - not model input');
    expect(html).toContain('Raw JSON');
  });
});
