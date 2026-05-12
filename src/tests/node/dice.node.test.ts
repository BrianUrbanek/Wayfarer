import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom } from '../../generator/seededRandom.js';
import {
  isSupportedDiceExpression,
  rollSupportedDice,
  SUPPORTED_DICE_EXPRESSIONS
} from '../../model/dice.js';

describe('dice helpers', () => {
  it('recognizes only supported expressions', () => {
    assert.equal(isSupportedDiceExpression('1d6'), true);
    assert.equal(isSupportedDiceExpression('4d8'), false);
    assert.deepEqual(SUPPORTED_DICE_EXPRESSIONS, ['1d2', '1d3', '1d4', '1d6', '2d3', '2d6', '3d6']);
  });

  it('rolls supported dice within the expected bounds', () => {
    const rng = createSeededRandom(12345);

    for (const expression of SUPPORTED_DICE_EXPRESSIONS) {
      const value = rollSupportedDice(expression, rng);
      const match = expression.match(/^(\d+)d(\d+)$/);

      assert.ok(match);
      const min = Number(match[1]);
      const max = Number(match[1]) * Number(match[2]);
      assert.ok(value >= min && value <= max, `${expression} rolled ${value} outside ${min}-${max}`);
    }
  });
});
