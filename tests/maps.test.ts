import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend, combineScoreBlocks, BLOCK_WEIGHT, ENEMY_WEIGHT } from '../src/recommend.ts';
import { defaultWeights } from '../src/weights.ts';
import type { Hero, Matchups, MapScores, Role } from '../src/recommend.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const heroes: Hero[] = read('../data/build/heroes.json');
const matchups: Matchups = read('../data/build/matchups.json');
const maps: { id: string; name_ko: string; mode: string }[] = read('../data/build/maps.json');
const mapScores: MapScores = read('../data/build/map_scores.json');
const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
const roles: Role[] = ['tank', 'damage', 'support'];

test('map data contains all 53 heroes × 30 maps, valid scores, five modes and matching WebP files', () => {
  assert.equal(heroes.length, 53);
  assert.equal(maps.length, 30);
  assert.equal(new Set(maps.map(map => map.id)).size, 30);
  assert.deepEqual(Object.fromEntries([...new Set(maps.map(map => map.mode))].map(mode => [mode, maps.filter(map => map.mode === mode).length])),
    { '쟁탈': 7, '호위': 8, '혼합': 8, '밀기': 4, '플래시포인트': 3 });
  assert.deepEqual(Object.keys(mapScores).sort(), heroes.map(hero => hero.id).sort());
  for (const hero of heroes) {
    assert.deepEqual(Object.keys(mapScores[hero.id]).sort(), maps.map(map => map.id).sort());
    for (const value of Object.values(mapScores[hero.id])) assert.ok(Number.isFinite(value) && value >= -3 && value <= 3);
  }
  for (const map of maps) {
    assert.match(map.id, /^[a-z0-9-]+$/);
    assert.ok(map.name_ko.length > 0);
    const bytes = readFileSync(new URL(`../public/maps/${map.id}.webp`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
});

test('new grade calibration matches both default block weights and default enemy weights', () => {
  const cuts = read('../data/build/grade_cuts.json');
  assert.deepEqual(cuts.block_weight, BLOCK_WEIGHT);
  assert.deepEqual(cuts.enemy_weight, ENEMY_WEIGHT);
});

test('without a map and with default weights all scores and ranks exactly match MVP 0.5', () => {
  const baseline: { cases: { enemies: string[]; results: Record<Role, [string, number, number][]> }[] } = read('./fixtures/recommend-v0.5.json');
  assert.equal(new Set(baseline.cases.flatMap(item => item.enemies)).size, 53);
  for (const item of baseline.cases) {
    for (const role of roles) {
      for (const options of [undefined, { mapId: null, mapScores, weights: defaultWeights() }]) {
        const rows = recommend(heroes, matchups, item.enemies, role, options);
        assert.deepEqual(rows.map(row => [row.hero.id, row.score, row.rank]), item.results[role]);
      }
    }
  }
});

test('a real map contributes 0.3 times its score to the real matchup subtotal', () => {
  // Widowmaker: 5 matchup points; Havana +3, Antarctic Peninsula -3.
  const score = (mapId: string) => recommend(heroes, matchups, enemies, 'damage', { mapId, mapScores }).find(row => row.hero.id === 'widowmaker')!.score;
  assert.equal(mapScores.widowmaker.havana, 3);
  assert.equal(mapScores.widowmaker['antarctic-peninsula'], -3);
  assert.equal(score('havana'), 5.9);
  assert.equal(score('antarctic-peninsula'), 4.1);
});

test('runtime enemy and block weights affect only their specified terms and preserve fractions', () => {
  const weights = defaultWeights();
  weights.enemy.damage.tank = 4.5;
  weights.block.matchup = 0.5;
  weights.block.map = 2;
  const fixture: Matchups = { hanzo: { dmon: 0.5, ashe: -1, genji: 2, ana: -2, mercy: 3 } };
  // (0.5×4.5 - 1 + 2 - 2 + 3)×0.5 + (-1.5)×2 = -0.875.
  const rows = recommend(heroes, fixture, enemies, 'damage', { mapId: 'havana', mapScores: { hanzo: { havana: -1.5 } }, weights });
  assert.equal(rows.find(row => row.hero.id === 'hanzo')!.score, -0.875);
  assert.deepEqual(ENEMY_WEIGHT.damage, { tank: 2, damage: 1, support: 1 });
  assert.deepEqual(BLOCK_WEIGHT, { matchup: 1, synergy: 0, map: 0.3 });
});

test('each role uses its own adjustable enemy-tank multiplier', () => {
  const weights = defaultWeights();
  weights.enemy.tank.tank = 0.5;
  weights.enemy.damage.tank = 4;
  weights.enemy.support.tank = 5;
  const candidates = { tank: 'roadhog', damage: 'hanzo', support: 'kiriko' };
  const fixture = Object.fromEntries(Object.values(candidates).map(id => [id, { dmon: 2 }]));
  for (const role of roles) {
    const row = recommend(heroes, fixture, enemies, role, { weights }).find(row => row.hero.id === candidates[role])!;
    assert.equal(row.score, 2 * weights.enemy[role].tank);
  }
});

test('zero block weights produce a true all-zero tie even with a map selected', () => {
  const weights = defaultWeights();
  weights.block.matchup = 0;
  weights.block.map = 0;
  const rows = recommend(heroes, matchups, enemies, 'damage', { mapId: 'havana', mapScores, weights });
  assert.ok(rows.every(row => row.score === 0 && row.rank === 1));
  assert.deepEqual(rows.map(row => row.hero.id), heroes.filter(hero => hero.role === 'damage').map(hero => hero.id));
});

test('missing map relations add zero, mirrors remain zero, and incomplete teams never recommend', () => {
  assert.deepEqual(recommend(heroes, matchups, enemies, 'damage', { mapId: 'unknown', mapScores }), recommend(heroes, matchups, enemies, 'damage'));
  assert.deepEqual(recommend(heroes, matchups, enemies, 'damage', { mapId: 'havana', mapScores: {} }), recommend(heroes, matchups, enemies, 'damage'));
  for (const role of roles) {
    const id = { tank: 'dmon', damage: 'ashe', support: 'ana' }[role];
    const rows = recommend(heroes, { [id]: { [id]: 3 } }, enemies, role, { mapId: 'havana', mapScores: {} });
    assert.ok(rows.every(row => row.score === 0 && row.rank === 1));
    assert.deepEqual(recommend(heroes, matchups, enemies.slice(1), role, { mapId: 'havana', mapScores }), []);
  }
});

test('decimal-weight arithmetic does not split mathematically equal scores into different ranks', () => {
  const weights = defaultWeights();
  weights.block.matchup = 0.1;
  weights.block.map = 0.3;
  const rows = recommend(heroes, { hanzo: { dmon: 1.5 } }, enemies, 'damage', { mapId: 'havana', mapScores: { widowmaker: { havana: 1 } }, weights });
  const tied = rows.filter(row => ['hanzo', 'widowmaker'].includes(row.hero.id));
  assert.ok(tied.every(row => row.score === 0.3 && row.rank === 1));
  assert.deepEqual(tied.map(row => row.hero.id), heroes.filter(hero => ['hanzo', 'widowmaker'].includes(hero.id)).map(hero => hero.id));
});

test('the block composition includes a reserved synergy term without changing current defaults', () => {
  assert.equal(combineScoreBlocks({ matchup: 4, synergy: 5, map: -2 }), 3.4);
  assert.equal(combineScoreBlocks({ matchup: 4, synergy: 5, map: -2 }, { matchup: 0.5, synergy: 1, map: 0.3 }), 6.4);
});
