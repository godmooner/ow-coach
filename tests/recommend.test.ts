import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend, toggleHero, formatScore } from '../src/recommend.ts';
import type { Hero, Matchups, Role } from '../src/recommend.ts';

const heroes: Hero[] = JSON.parse(readFileSync(new URL('../data/build/heroes.json', import.meta.url), 'utf8'));
const matchups: Matchups = JSON.parse(readFileSync(new URL('../data/build/matchups.json', import.meta.url), 'utf8'));
const legacyMatchups: Matchups = JSON.parse(readFileSync(new URL('./fixtures/matchups-v0.3.json', import.meta.url), 'utf8'));
const baseline: { cases: { enemies: string[]; legacy: [string, number, number][]; expanded: [string, number, number][] }[] } =
  JSON.parse(readFileSync(new URL('./fixtures/recommend-v0.3.json', import.meta.url), 'utf8'));
const roles: Role[] = ['tank', 'damage', 'support'];

test('all data keys resolve and scores are finite numbers, including fractions', () => {
  const ids = new Set(heroes.map(hero => hero.id));
  const entries = Object.entries(matchups).flatMap(([source, row]) => Object.entries(row).map(([target, score]) => ({source, target, score})));
  assert.equal(ids.size, heroes.length);
  assert.ok(heroes.filter(hero => hero.role === 'damage').length >= 3);
  assert.ok(entries.length > 0);
  for (const {source, target, score} of entries) {
    assert.ok(ids.has(source) && ids.has(target));
    assert.ok(Number.isFinite(score) && score >= -3 && score <= 3);
  }
});

test('fractional scores sum in the candidate-to-enemy direction', () => {
  const enemies = ['domina', 'ashe', 'bastion', 'ana', 'mercy'];
  // A fixed fixture lets the real data change without breaking calculation tests.
  const fixture: Matchups = {genji: {domina: -0.5, ashe: 3, bastion: 3, ana: 0, mercy: 2}};
  const results = recommend(heroes, fixture, enemies, 'damage');
  assert.equal(results.length, heroes.filter(hero => hero.role === 'damage').length);
  assert.equal(results.find(row => row.hero.id === 'genji')?.score, 7);
  assert.deepEqual(results, recommend(heroes, fixture, [...enemies].reverse(), 'damage'));
  assert.equal(formatScore(-2.5), '−2.5');
  assert.equal(formatScore(1.5), '+1.5');
});

test('missing rows stay eligible; mirror is zero; ties keep hero-list order', () => {
  const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
  const minimal: Matchups = { ashe: { ashe: 3, dmon: 0.5 } };
  const results = recommend(heroes, minimal, enemies, 'damage');
  assert.equal(results.length, heroes.filter(hero => hero.role === 'damage').length);
  assert.equal(results[0].hero.id, 'ashe');
  assert.equal(results[0].score, 1);
  const ties = recommend(heroes, {}, enemies, 'damage');
  assert.deepEqual(ties.slice(0, 3).map(row => row.hero.id), heroes.filter(hero => hero.role === 'damage').slice(0, 3).map(hero => hero.id));
  assert.ok(ties.every(row => row.rank === 1 && row.score === 0));
});

test('selection obeys 1/2/2, removes an existing pick, and rejects incomplete teams', () => {
  const hero = (id: string) => heroes.find(item => item.id === id)!;
  let selected = toggleHero([], hero('dva'), heroes);
  assert.deepEqual(toggleHero(selected, hero('domina'), heroes), ['dva']);
  selected = toggleHero(selected, hero('genji'), heroes);
  selected = toggleHero(selected, hero('ashe'), heroes);
  assert.deepEqual(toggleHero(selected, hero('bastion'), heroes), selected);
  assert.deepEqual(toggleHero(selected, hero('genji'), heroes), ['dva', 'ashe']);
  assert.deepEqual(recommend(heroes, matchups, selected, 'damage'), []);
  assert.deepEqual(recommend(heroes, matchups, ['dva', 'ashe', 'ashe', 'ana', 'mercy'], 'damage'), []);
});

test('the expanded data preserves all 1,190 MVP 0.3 relations', () => {
  let checked = 0;
  for (const [source, row] of Object.entries(legacyMatchups)) {
    for (const [target, score] of Object.entries(row)) {
      assert.equal(matchups[source]?.[target], score, `${source} → ${target}`);
      checked++;
    }
  }
  assert.equal(checked, 1190);
});

test('damage differs from the 0.3 baseline only by one extra enemy-tank term', () => {
  // Snapshots were captured before changing recommend(), for both data versions.
  // The 16 teams cover every hero as an enemy, including newly filled relations.
  assert.equal(new Set(baseline.cases.flatMap(item => item.enemies)).size, heroes.length);
  for (const { enemies, legacy, expanded } of baseline.cases) {
    const tankId = enemies.find(id => heroes.find(hero => hero.id === id)?.role === 'tank')!;
    for (const [data, unweighted] of [[legacyMatchups, legacy], [matchups, expanded]] as const) {
      const weighted = unweighted.map(([id, score]) => ({ id, score: score + (data[id]?.[tankId] ?? 0) }))
        .sort((a, b) => b.score - a.score || heroes.findIndex(hero => hero.id === a.id) - heroes.findIndex(hero => hero.id === b.id));
      let rank = 0;
      const expected = weighted.map((row, index) => {
        if (index === 0 || row.score !== weighted[index - 1].score) rank = index + 1;
        return [row.id, row.score, rank];
      });
      const actual = recommend(heroes, data, enemies, 'damage').map(row => [row.hero.id, row.score, row.rank]);
      assert.deepEqual(actual, expected, enemies.join(', '));
    }
  }
});

for (const role of roles) {
  test(`${role} recommendations contain all and only heroes in the selected role`, () => {
    const results = recommend(heroes, matchups, ['dmon', 'ashe', 'genji', 'ana', 'mercy'], role);
    assert.deepEqual(new Set(results.map(row => row.hero.id)), new Set(heroes.filter(hero => hero.role === role).map(hero => hero.id)));
    assert.equal(results.slice(0, 3).length, 3);
    assert.ok(results.every(row => row.hero.role === role));
  });
}

test('tank selection triples only the enemy tank term, including fractional scores', () => {
  const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
  // Supplied data: Ramattra → D.Mon 0.5, Ashe 0, Genji 2, Ana -2, Mercy 2.
  // Hand calculation: 0.5 × 3 + 0 + 2 - 2 + 2 = 3.5 (unweighted: 2.5).
  const results = recommend(heroes, matchups, enemies, 'tank');
  assert.equal(results.find(row => row.hero.id === 'ramattra')?.score, 3.5);
  // Roadhog: 2 × 3 + 0 + 3 - 3 + 2 = 8; both other role subtotals are nonzero.
  assert.equal(results.find(row => row.hero.id === 'roadhog')?.score, 8);
  assert.deepEqual(results, recommend(heroes, matchups, [...enemies].reverse(), 'tank'));
});

test('damage and support double only the enemy tank term', () => {
  const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
  const row = { dmon: 0.5, ashe: -1, genji: 2, ana: -2, mercy: 3 };
  const fixture: Matchups = { hanzo: row, zenyatta: row };
  // 0.5 × 2 - 1 + 2 - 2 + 3 = 3. Both other role subtotals are nonzero.
  assert.equal(recommend(heroes, fixture, enemies, 'damage').find(item => item.hero.id === 'hanzo')?.score, 3);
  assert.equal(recommend(heroes, fixture, enemies, 'support').find(item => item.hero.id === 'zenyatta')?.score, 3);
});

test('tank scores, ranks and tie order match unchanged MVP 0.4 across all enemy heroes', () => {
  const baseline: { cases: { enemies: string[]; expected: [string, number, number][] }[] } =
    JSON.parse(readFileSync(new URL('./fixtures/recommend-tank-v0.4.json', import.meta.url), 'utf8'));
  assert.equal(new Set(baseline.cases.flatMap(item => item.enemies)).size, heroes.length);
  for (const { enemies, expected } of baseline.cases) {
    assert.deepEqual(recommend(heroes, matchups, enemies, 'tank').map(row => [row.hero.id, row.score, row.rank]), expected);
  }
});

test('real-data damage and support totals match the hand calculation with tank weight two', () => {
  const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
  // Junkrat: 3 × 2 - 2 + 0 + 2 + 2 = 8 (MVP 0.4: 5).
  assert.equal(recommend(heroes, matchups, enemies, 'damage').find(row => row.hero.id === 'junkrat')?.score, 8);
  // Kiriko: 2 × 2 + 0 + 0 + 3 + 0 = 7 (MVP 0.4: 5).
  assert.equal(recommend(heroes, matchups, enemies, 'support').find(row => row.hero.id === 'kiriko')?.score, 7);
});

test('mirror terms stay zero and missing relations and ties work for every role', () => {
  const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
  const mirrors: Record<Role, string> = { tank: 'dmon', damage: 'ashe', support: 'ana' };
  for (const role of roles) {
    const id = mirrors[role];
    const results = recommend(heroes, { [id]: { [id]: 3 } }, enemies, role);
    assert.deepEqual(results.map(row => row.hero.id), heroes.filter(hero => hero.role === role).map(hero => hero.id));
    assert.ok(results.every(row => row.score === 0 && row.rank === 1));
    assert.ok(results.some(row => row.hero.id === id));
  }
});

test('every selected role still requires exactly one tank, two damage and two support enemies', () => {
  const invalidTeams = [
    ['dmon', 'ashe', 'ana', 'mercy'],
    ['dmon', 'ashe', 'ashe', 'ana', 'mercy'],
    ['dmon', 'dva', 'ashe', 'ana', 'mercy'],
    ['unknown', 'ashe', 'genji', 'ana', 'mercy'],
    ['dmon', 'ashe', 'genji', 'ana', 'mercy', 'zenyatta'],
  ];
  for (const role of roles) {
    for (const enemies of invalidTeams) assert.deepEqual(recommend(heroes, matchups, enemies, role), []);
  }
});
