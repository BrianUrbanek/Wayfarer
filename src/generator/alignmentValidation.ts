export function assertValidAlignment(alignment: number): void {
  if (!Number.isFinite(alignment) || !Number.isInteger(alignment) || alignment < 0 || alignment > 10) {
    throw new Error(`Invalid alignment value: ${String(alignment)}. Expected an integer from 0 to 10.`);
  }
}
