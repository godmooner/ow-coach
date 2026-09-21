import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend } from '../src/recommend.ts';
import { loadWeights, saveWeights, defaultWeights, WEIGHTS_KEY } from '../src/weights.ts';
import type { Hero, Matchups, MapScores } from '../src/recommend.ts';

const read = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
const heroes: Hero[] = read('../data/build/heroes.json');
const matchups: Matchups = read('../data/build/matchups.json');
const mapScores: MapScores = read('../data/build/map_scores.json');
const legacy = { block: { matchup: 1, synergy: 0, map: 0.3 }, enemy: {
  tank: { tank: 3, damage: 1, support: 1 }, damage: { tank: 2, damage: 1, support: 1 }, support: { tank: 2, damage: 1, support: 1 },
} };
const storage = (entries: Record<string, string>) => ({
  getItem: (key: string) => entries[key] ?? null,
  setItem: (key: string, value: string) => { entries[key] = value; },
});

test('v1.5 balances long sightlines without ignoring enemy anti-dive pressure', () => {
  const longRange = recommend(heroes, matchups, ['sigma', 'widowmaker', 'ashe', 'zenyatta', 'illari'], 'tank', { mapId: 'circuit-royal', mapScores });
  assert.deepEqual(longRange.slice(0, 3).map(row => [row.hero.id, row.score]), [['sigma', 9.8], ['wreckingball', 9.46], ['winston', 8.76]]);
  const antiDive = recommend(heroes, matchups, ['zarya', 'reaper', 'bastion', 'ana', 'zenyatta'], 'tank', { mapId: 'watchpoint-gibraltar', mapScores });
  // Sigma: Zarya 2×2 + Reaper .5 + Bastion 1 + Ana 2 + Zen 2 + map -.4×.6 = 9.26.
  // Winston: 3×2 - 3 - 3 + 2 - 2 + 3×.6 = 1.8.
  assert.deepEqual(antiDive.slice(0, 2).map(row => [row.hero.id, row.score]), [['sigma', 9.26], ['winston', 1.8]]);
});

test('v1.5 upgrades saved legacy defaults and preserves custom settings on subsequent visits', () => {
  const saved = storage({ 'ow-coach.weights.v1': JSON.stringify(legacy) });
  const upgraded = loadWeights(saved);
  assert.equal(upgraded.block.map, 0.6);
  assert.equal(upgraded.enemy.tank.tank, 2);
  assert.equal(upgraded.enemy.damage.tank, 1.5);
  assert.equal(upgraded.enemy.support.tank, 1.5);
  saveWeights(upgraded, saved);
  assert.deepEqual(loadWeights(saved), defaultWeights());
  // Deliberately choosing old values in v1.5 is a custom setting, not another migration.
  saveWeights(legacy, saved);
  assert.deepEqual(loadWeights(saved), legacy);
  assert.notEqual(WEIGHTS_KEY, 'ow-coach.weights.v1');
});

test('v1.5 preserves legacy custom weights, including a genuine zero map weight', () => {
  const custom = structuredClone(legacy); custom.block.map = 0; custom.enemy.damage.tank = 4;
  assert.deepEqual(loadWeights(storage({ 'ow-coach.weights.v1': JSON.stringify(custom) })), custom);
});

test('the data patch changes only the 18 reviewed directed relations and keeps both unknown relations missing', () => {
  const before: Matchups = read('./fixtures/matchups-v1.0.1.json');
  const entries = read('../data/revisions/v1.5-matchup-corrections.json').entries;
  const expected = new Map(entries.map((e: { source_id: string; target_id: string; after: number }) => [`${e.source_id}/${e.target_id}`, e.after]));
  let changes = 0;
  for (const hero of heroes) {
    assert.deepEqual(Object.keys(matchups[hero.id]).sort(), Object.keys(before[hero.id]).sort());
    for (const [enemy, old] of Object.entries(before[hero.id])) {
      const key = `${hero.id}/${enemy}`;
      assert.equal(matchups[hero.id][enemy], expected.has(key) ? expected.get(key) : old, key);
      if (matchups[hero.id][enemy] !== old) changes++;
    }
  }
  assert.equal(changes, 18);
  assert.equal(matchups.domina.cassidy, undefined);
  assert.equal(matchups.cassidy.domina, undefined);
});
