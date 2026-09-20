import { BLOCK_WEIGHT, ENEMY_WEIGHT } from './recommend.ts';
import type { ScoringWeights, Role } from './recommend';

export const WEIGHTS_KEY = 'ow-coach.weights.v1';
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

export function loadWeights(storage: Pick<Storage, 'getItem'>): ScoringWeights {
  const weights = defaultWeights();
  try {
    const saved = record(JSON.parse(storage.getItem(WEIGHTS_KEY) ?? '{}'));
    const block = record(saved.block);
    for (const key of ['matchup', 'map'] as const) weights.block[key] = sliderValue(block[key], 2, 0.05, BLOCK_WEIGHT[key]);
    const enemy = record(saved.enemy);
    for (const role of roles) weights.enemy[role].tank = sliderValue(record(enemy[role]).tank, 5, 0.5, ENEMY_WEIGHT[role].tank);
  } catch { /* Missing or inaccessible storage must not block the app. */ }
  return weights;
}

export function saveWeights(weights: ScoringWeights, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
}
