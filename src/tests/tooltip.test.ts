import { describe, expect, it } from 'vitest';
import { resolveTooltipPlacement } from '../ui/components/Tooltip';

describe('tooltip placement', () => {
  it('opens toward the center when the trigger is near the left edge', () => {
    const placement = resolveTooltipPlacement(
      { left: 32, right: 56, top: 120, bottom: 144, width: 24, height: 24 },
      { width: 320, height: 180 },
      { width: 1440, height: 900 }
    );

    expect(placement.left).toBeGreaterThanOrEqual(32);
    expect(placement.left).toBeLessThan(360);
    expect(placement.top).toBeGreaterThanOrEqual(144);
  });

  it('opens toward the center when the trigger is near the right edge', () => {
    const placement = resolveTooltipPlacement(
      { left: 1320, right: 1344, top: 160, bottom: 184, width: 24, height: 24 },
      { width: 320, height: 180 },
      { width: 1440, height: 900 }
    );

    expect(placement.left).toBeLessThan(1320);
    expect(placement.left).toBeGreaterThan(1000);
    expect(placement.top).toBeGreaterThanOrEqual(184);
  });
});
