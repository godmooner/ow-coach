import { BLOCK_WEIGHT, ENEMY_WEIGHT } from './recommend.ts';
import type { ScoringWeights, Role } from './recommend';

export const WEIGHTS_KEY = 'ow-coach.weights.v1.5';
const LEGACY_WEIGHTS_KEY = 'ow-coach.weights.v1';
const legacyDefaults: ScoringWeights = {
  block: { matchup: 1, synergy: 0, map: 0.3 },
  enemy: { tank: { tank: 3, damage: 1, support: 1 }, damage: { tank: 2, damage: 1, support: 1 }, support: { tank: 2, damage: 1, support: 1 } },
};
const roles: Role[] = ['tank', 'damage', 'support'];
export function defaultWeights(): ScoringWeights {
  return { block: { ...BLOCK_WEIGHT }, enemy: {
    tank: { ...ENEMY_WEIGHT.tank }, damage: { ...ENEMY_WEIGHT.damage }, support: { ...ENEMY_WEIGHT.support },
  } };
}
export function weightsAreDefault(weights: ScoringWeights): boolean {
  return (Object.keys(BLOCK_WEIGHT) as (keyof ScoringWeights['block'])[]).every(key => weights.block[key] === BLOCK_WEIGHT[key])
    && roles.every(role => roles.every(enemyRole => weights.enemy[role][enemyRole] === ENEMY_WEIGHT[role][enemyRole]));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function sliderValue(value: unknown, max: number, step: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) return fallback;
  const steps = Math.round(value / step);
  return Math.abs(steps * step - value) < 1e-9 ? Number((steps * step).toFixed(2)) : fallback;
}

function normalize(saved: Record<string, unknown>, base: ScoringWeights): ScoringWeights {
  const weights: ScoringWeights = { block: { ...base.block }, enemy: {
    tank: { ...base.enemy.tank }, damage: { ...base.enemy.damage }, support: { ...base.enemy.support },
  } };
  const block = record(saved.block);
  for (const key of ['matchup', 'map'] as const) weights.block[key] = sliderValue(block[key], 2, 0.05, base.block[key]);
  const enemy = record(saved.enemy);
  for (const role of roles) weights.enemy[role].tank = sliderValue(record(enemy[role]).tank, 5, 0.5, base.enemy[role].tank);
  return weights;
}

export function loadWeights(storage: Pick<Storage, 'getItem'>): ScoringWeights {
  try {
    const current = storage.getItem(WEIGHTS_KEY);
    if (current !== null) return normalize(record(JSON.parse(current)), defaultWeights());
    const legacy = normalize(record(JSON.parse(storage.getItem(LEGACY_WEIGHTS_KEY) ?? '{}')), legacyDefaults);
    const wasDefault = legacy.block.matchup === legacyDefaults.block.matchup && legacy.block.map === legacyDefaults.block.map
      && roles.every(role => legacy.enemy[role].tank === legacyDefaults.enemy[role].tank);
    return wasDefault ? defaultWeights() : legacy;
  } catch { return defaultWeights(); /* Storage must never block the app. */ }
}

export function saveWeights(weights: ScoringWeights, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}
