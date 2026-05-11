export interface SeededRng {
  next(): number;
  int(maxExclusive: number): number;
  range(minInclusive: number, maxInclusive: number): number;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
}

function normalizeSeed(seed: number): number {
  return (seed >>> 0) || 1;
}

export function createSeededRandom(seed: number): SeededRng {
  let state = normalizeSeed(seed);

  const next = () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (maxExclusive: number) => {
    if (maxExclusive <= 0) {
      return 0;
    }

    return Math.floor(next() * maxExclusive);
  };

  const range = (minInclusive: number, maxInclusive: number) => {
    if (maxInclusive <= minInclusive) {
      return minInclusive;
    }

    return minInclusive + int(maxInclusive - minInclusive + 1);
  };

  const pick = <T>(values: readonly T[]) => {
    if (values.length === 0) {
      throw new Error('Cannot pick from an empty array.');
    }

    return values[int(values.length)];
  };

  const shuffle = <T>(values: readonly T[]) => {
    const result = values.slice();

    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = int(index + 1);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }

    return result;
  };

  return {
    next,
    int,
    range,
    pick,
    shuffle
  };
}
