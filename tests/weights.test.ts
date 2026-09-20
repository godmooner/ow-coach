import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultWeights, weightsAreDefault, loadWeights, saveWeights, WEIGHTS_KEY } from '../src/weights.ts';

const storageWith = (value: string | null = null) => {
  let saved = value;
  return { getItem: (_key: string) => saved, setItem: (key: string, next: string) => { assert.equal(key, WEIGHTS_KEY); saved = next; } };
};

test('custom weights round-trip through storage without changing defaults', () => {
  const weights = defaultWeights();
  weights.block.matchup = 1.15;
  weights.block.map = 1.25;
  weights.enemy.tank.tank = 4.5;
  weights.enemy.damage.tank = 3.5;
  weights.enemy.support.tank = 0;
  const storage = storageWith();
  saveWeights(weights, storage);
  assert.deepEqual(loadWeights(storage), weights);
  assert.equal(defaultWeights().block.matchup, 1);
  assert.equal(defaultWeights().enemy.tank.tank, 3);
});

test('each adjustable value activates the custom indicator and defaults clear it', () => {
  assert.equal(weightsAreDefault(defaultWeights()), true);
  for (const field of ['matchup', 'map'] as const) {
    const weights = defaultWeights(); weights.block[field] = 2;
    assert.equal(weightsAreDefault(weights), false);
  }
  for (const role of ['tank', 'damage', 'support'] as const) {
    const weights = defaultWeights(); weights.enemy[role].tank = 5;
    assert.equal(weightsAreDefault(weights), false);
  }
  assert.equal(weightsAreDefault(defaultWeights()), true);
});

test('restoration accepts range endpoints but rejects invalid values and ignores disabled fields', () => {
  const raw = { block: { matchup: 2, map: 0, synergy: 2 }, enemy: {
    tank: { tank: 5, damage: 5, support: 5 }, damage: { tank: 0 }, support: { tank: 2.5 },
  } };
  const restored = loadWeights(storageWith(JSON.stringify(raw)));
  assert.deepEqual(restored.block, { matchup: 2, synergy: 0, map: 0 });
  assert.deepEqual(restored.enemy, { tank: { tank: 5, damage: 1, support: 1 }, damage: { tank: 0, damage: 1, support: 1 }, support: { tank: 2.5, damage: 1, support: 1 } });
  for (const value of [-1, 2.05, 0.01, '1', null, true]) {
    assert.equal(loadWeights(storageWith(JSON.stringify({ block: { matchup: value, map: 1.25 } }))).block.matchup, 1);
    assert.equal(loadWeights(storageWith(JSON.stringify({ block: { matchup: value, map: 1.25 } }))).block.map, 1.25);
  }
  for (const value of [-0.5, 5.5, 0.25, '3', null, true]) {
    assert.equal(loadWeights(storageWith(JSON.stringify({ enemy: { tank: { tank: value } } }))).enemy.tank.tank, 3);
  }
});

test('missing, corrupt and inaccessible storage fall back to default settings', () => {
  for (const value of [null, '', '{bad', 'null', '[]', '42']) assert.deepEqual(loadWeights(storageWith(value)), defaultWeights());
  assert.deepEqual(loadWeights({ getItem: () => { throw new Error('blocked'); } }), defaultWeights());
});
