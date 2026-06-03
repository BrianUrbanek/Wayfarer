import type { TagId } from './types.js';

export function clamp(value: number, min = -1, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function lerp(min: number, max: number, amount: number): number {
  return min + (max - min) * clamp(amount, 0, 1);
}

export function confidenceFromRD(rd: number): number {
  return clamp(1 - rd, 0.05, 1);
}

export function volatilityPenalty(volatility: number): number {
  return clamp(1 - volatility * 0.5, 0.1, 1);
}

export function cloneNumberRecord(record: Record<TagId, number>): Record<TagId, number> {
  return { ...record };
}

export function makeZeroVector(tags: readonly TagId[]): Record<TagId, number> {
  return Object.fromEntries(tags.map((tag) => [tag, 0])) as Record<TagId, number>;
}
