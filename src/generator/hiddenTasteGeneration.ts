import type { CohortAnchor, CohortId, HiddenTasteCohort, HiddenTasteTruthClass, Island, IslandId, MaybeRating, Rating, TagId } from '../model/types.js';
import type { SeededRng } from './seededRandom.js';

export interface HiddenTasteGenerationResult {
  hiddenTasteCohorts: HiddenTasteCohort[];
  hiddenTasteCohortsById: ReadonlyMap<CohortId, HiddenTasteCohort>;
}

export interface HiddenIslandTruth {
  hiddenTruthClass: HiddenTasteTruthClass;
  hiddenTargetTasteCohortId: CohortId | null;
  hiddenAppealVector: Record<TagId, number>;
}

export interface HiddenIslandTruthResult extends HiddenIslandTruth {
  hiddenAppealPattern: Record<CohortId, Rating>;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0 || 1;
}

function randomDiscreteAppealValue(rng: SeededRng): -1 | 0 | 1 {
  const values: Array<-1 | 0 | 1> = [-1, 0, 1];
  return values[rng.int(values.length)] ?? 0;
}

function vectorDot(left: Record<TagId, number>, right: Record<TagId, number>): number {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let sum = 0;

  for (const key of keys) {
    sum += (left[key] ?? 0) * (right[key] ?? 0);
  }

  return sum;
}

function vectorMagnitude(vector: Record<TagId, number>): number {
  return Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0));
}

function cosineLikeSimilarity(left: Record<TagId, number>, right: Record<TagId, number>): number {
  const magnitude = vectorMagnitude(left) * vectorMagnitude(right);
  if (magnitude <= 0) {
    return 0;
  }

  return vectorDot(left, right) / magnitude;
}

function buildPreferenceVector(
  allTags: readonly TagId[],
  preferredTags: readonly TagId[],
  secondaryTags: readonly TagId[] = []
): Record<TagId, number> {
  const preferred = new Set(preferredTags);
  const secondary = new Set(secondaryTags);

  return Object.fromEntries(
    allTags.map((tag) => [
      tag,
      preferred.has(tag) ? 1 : secondary.has(tag) ? -0.6 : -0.15
    ])
  ) as Record<TagId, number>;
}

function sampleTags(rng: SeededRng, tags: readonly TagId[], count: number): TagId[] {
  if (count <= 0 || tags.length === 0) {
    return [];
  }

  return rng.shuffle(tags).slice(0, Math.min(count, tags.length));
}

function clampAppealVector(
  appealVector: Record<TagId, number>,
  stampedTags: ReadonlySet<TagId>
): Record<TagId, number> {
  return Object.fromEntries(
    Object.entries(appealVector).map(([tag, value]) => {
      if (stampedTags.has(tag)) {
        return [tag, value];
      }

      return [tag, Math.max(-2, Math.min(2, value))];
    })
  ) as Record<TagId, number>;
}

function buildTargetedAppealVector(
  rng: SeededRng,
  allTags: readonly TagId[],
  targetCohort: HiddenTasteCohort
): Record<TagId, number> {
  const stampedTags = new Set(targetCohort.tagSignature);
  const appealVector = Object.fromEntries(
    allTags.map((tag) => [tag, stampedTags.has(tag) ? 1 : randomDiscreteAppealValue(rng)])
  ) as Record<TagId, number>;

  return clampAppealVector(appealVector, stampedTags);
}

function buildRandomAppealVector(
  rng: SeededRng,
  allTags: readonly TagId[]
): Record<TagId, number> {
  const appealVector = Object.fromEntries(allTags.map((tag) => [tag, randomDiscreteAppealValue(rng)])) as Record<TagId, number>;
  return clampAppealVector(appealVector, new Set());
}

function makeSeedTasteCohort(cohort: CohortAnchor, allTags: readonly TagId[]): HiddenTasteCohort {
  return {
    id: cohort.id,
    label: cohort.label,
    kind: 'seed',
    sourceSeedCohortId: cohort.id,
    projectedSeedCohortId: cohort.id,
    preferenceVector: buildPreferenceVector(allTags, cohort.tags, []),
    tagSignature: cohort.tags.slice()
  };
}

function makeUnseededTasteCohort(
  rng: SeededRng,
  seedCohort: CohortAnchor,
  partnerSeedCohort: CohortAnchor,
  allTags: readonly TagId[],
  index: number
): HiddenTasteCohort {
  const combinedSeedTags = Array.from(new Set([...seedCohort.tags, ...partnerSeedCohort.tags]));
  const signatureCount = Math.max(2, Math.min(allTags.length, Math.round(Math.max(seedCohort.tags.length, partnerSeedCohort.tags.length) * 0.75) || 2));
  const signature = sampleTags(rng, combinedSeedTags.length > 0 ? combinedSeedTags : allTags, signatureCount);
  const secondaryPool = allTags.filter((tag) => !signature.includes(tag));
  const secondary = sampleTags(rng, secondaryPool, Math.max(1, Math.min(secondaryPool.length, Math.ceil(signature.length / 2))));

  return {
    id: `hidden-unseeded-${index + 1}`,
    label: `Unseeded Hidden ${index + 1}`,
    kind: 'unseeded',
    sourceSeedCohortId: seedCohort.id,
    projectedSeedCohortId: partnerSeedCohort.id,
    preferenceVector: buildPreferenceVector(allTags, signature, secondary),
    tagSignature: signature
  };
}

export function generateHiddenTasteCohorts(
  rng: SeededRng,
  seedCohorts: readonly CohortAnchor[],
  allTags: readonly TagId[]
): HiddenTasteGenerationResult {
  const seedTasteCohorts = seedCohorts.map((cohort) => makeSeedTasteCohort(cohort, allTags));
  const unseededTasteCohorts = seedCohorts.map((cohort, index) =>
    makeUnseededTasteCohort(
      rng,
      cohort,
      seedCohorts[(index + 1) % seedCohorts.length] ?? cohort,
      allTags,
      index
    )
  );
  const hiddenTasteCohorts = seedTasteCohorts.concat(unseededTasteCohorts);

  return {
    hiddenTasteCohorts,
    hiddenTasteCohortsById: new Map(hiddenTasteCohorts.map((cohort) => [cohort.id, cohort]))
  };
}

export function buildIslandTruth(
  rng: SeededRng,
  island: Island,
  hiddenTasteCohorts: readonly HiddenTasteCohort[],
  allTags: readonly TagId[],
  islandIndex: number
): HiddenIslandTruthResult {
  const roll = rng.next();
  const seedTasteCohorts = hiddenTasteCohorts.filter((cohort) => cohort.kind === 'seed');
  const unseededTasteCohorts = hiddenTasteCohorts.filter((cohort) => cohort.kind === 'unseeded');

  let hiddenTruthClass: HiddenTasteTruthClass = 'random';
  let hiddenTargetTasteCohortId: CohortId | null = null;
  let targetCohort: HiddenTasteCohort | null = null;

  if (roll < 0.4 && seedTasteCohorts.length > 0) {
    hiddenTruthClass = 'seed-cohort-match';
    targetCohort = seedTasteCohorts[Math.abs(hashString(`${island.id}:${islandIndex}:seed`)) % seedTasteCohorts.length] ?? null;
  } else if (roll < 0.7 && unseededTasteCohorts.length > 0) {
    hiddenTruthClass = 'unseeded-cohort-match';
    targetCohort = unseededTasteCohorts[Math.abs(hashString(`${island.id}:${islandIndex}:unseeded`)) % unseededTasteCohorts.length] ?? null;
  }

  if (targetCohort) {
    hiddenTargetTasteCohortId = targetCohort.id;
  }

  const hiddenAppealVector =
    hiddenTruthClass === 'random'
      ? buildRandomAppealVector(rng, allTags)
      : targetCohort
        ? buildTargetedAppealVector(rng, allTags, targetCohort)
        : buildRandomAppealVector(rng, allTags);

  const hiddenAppealPattern = Object.fromEntries(
    seedTasteCohorts.map((cohort) => [
      cohort.id,
      Math.sign(cosineLikeSimilarity(cohort.preferenceVector, hiddenAppealVector)) as Rating
    ])
  ) as Record<CohortId, Rating>;

  return {
    hiddenTruthClass,
    hiddenTargetTasteCohortId,
    hiddenAppealVector,
    hiddenAppealPattern
  };
}

export function scoreHiddenTasteFit(
  userPreferenceVector: Record<TagId, number>,
  islandAppealVector: Record<TagId, number>
): number {
  return cosineLikeSimilarity(userPreferenceVector, islandAppealVector);
}

export function projectFitToRating(fit: number, rng: SeededRng): Rating {
  if (fit >= 0.52) {
    return 1;
  }

  if (fit <= -0.52) {
    return -1;
  }

  if (fit >= 0.18) {
    return rng.next() < 0.65 ? 1 : 0;
  }

  if (fit <= -0.18) {
    return rng.next() < 0.65 ? -1 : 0;
  }

  return rng.next() < 0.5 ? 0 : (fit > 0 ? 1 : -1);
}

export function buildTruthRatingsForTasteCohort(
  rng: SeededRng,
  islands: readonly Island[],
  hiddenTasteCohort: HiddenTasteCohort
): Record<IslandId, MaybeRating> {
  return Object.fromEntries(
    islands.map((island) => {
      const fit = scoreHiddenTasteFit(hiddenTasteCohort.preferenceVector, island.hiddenAppealVector ?? {});
      return [island.id, projectFitToRating(fit, rng)];
    })
  ) as Record<IslandId, MaybeRating>;
}
