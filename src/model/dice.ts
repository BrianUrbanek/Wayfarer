import type { SeededRng } from '../generator/seededRandom.js';

export type SupportedDiceExpression = '1d2' | '1d3' | '1d4' | '1d6' | '2d3' | '2d6' | '3d6';

const SUPPORTED_DICE: Record<SupportedDiceExpression, [number, number]> = {
  '1d2': [1, 2],
  '1d3': [1, 3],
  '1d4': [1, 4],
  '1d6': [1, 6],
  '2d3': [2, 3],
  '2d6': [2, 6],
  '3d6': [3, 6]
};

export const SUPPORTED_DICE_EXPRESSIONS: SupportedDiceExpression[] = [
  '1d2',
  '1d3',
  '1d4',
  '1d6',
  '2d3',
  '2d6',
  '3d6'
];

export function isSupportedDiceExpression(value: string): value is SupportedDiceExpression {
  return value in SUPPORTED_DICE;
}

export function rollSupportedDice(expression: SupportedDiceExpression, rng: SeededRng): number {
  const [count, sides] = SUPPORTED_DICE[expression];
  let total = 0;

  for (let index = 0; index < count; index += 1) {
    total += rng.range(1, sides);
  }

  return total;
}
