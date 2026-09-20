import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeForScore, filterRecommendations } from '../src/recommendationView.ts';
import { ENEMY_WEIGHT, recommend } from '../src/recommend.ts';
import type { Hero, Matchups, Role } from '../src/recommend.ts';

const gradeCuts = JSON.parse(readFileSync(new URL('../data/build/grade_cuts.json', import.meta.url), 'utf8'));
const heroes: Hero[] = JSON.parse(readFileSync(new URL('../data/build/heroes.json', import.meta.url), 'utf8'));
const matchups: Matchups = JSON.parse(readFileSync(new URL('../data/build/matchups.json', import.meta.url), 'utf8'));
const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];

test('grade calibration uses exactly the engine weights and six increasing cuts per role', () => {
  assert.deepEqual(gradeCuts.enemy_weight, ENEMY_WEIGHT);
  assert.equal(gradeCuts.labels.length, 7);
  for (const role of ['tank', 'damage', 'support'] as Role[]) {
    const cuts: number[] = gradeCuts.cuts[role];
    assert.equal(cuts.length, 6);
    assert.ok(cuts.every((cut, i) => Number.isFinite(cut) && (i === 0 || cut > cuts[i - 1])));
  }
});

for (const role of ['tank', 'damage', 'support'] as Role[]) {
  test(`${role} grade includes each cutoff and changes immediately above it`, () => {
    const cuts: number[] = gradeCuts.cuts[role];
    cuts.forEach((cut, i) => {
      assert.deepEqual(gradeForScore(cut - 0.0001, role), { label: gradeCuts.labels[i], level: i });
      assert.deepEqual(gradeForScore(cut, role), { label: gradeCuts.labels[i], level: i });
      assert.deepEqual(gradeForScore(cut + 0.0001, role), { label: gradeCuts.labels[i + 1], level: i + 1 });
    });
    assert.equal(gradeForScore(-21, role).label, '매우 불리');
    assert.equal(gradeForScore(21, role).label, '매우 유리');
  });
}

test('no preferences and all preferences return the full same ranking for each role', () => {
  for (const role of ['tank', 'damage', 'support'] as Role[]) {
    const all = recommend(heroes, matchups, enemies, role);
    assert.deepEqual(filterRecommendations(all, []), all);
    assert.deepEqual(filterRecommendations(all, all.map(row => row.hero.id).reverse()), all);
    assert.equal(all.length, heroes.filter(hero => hero.role === role).length);
  }
});

test('preferences filter before top-three slicing, including heroes outside the unfiltered top three', () => {
  const all = recommend(heroes, matchups, enemies, 'damage');
  const choices = all.slice(-2);
  const filtered = filterRecommendations(all, choices.map(row => row.hero.id).reverse());
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map(row => [row.hero.id, row.score]), choices.map(row => [row.hero.id, row.score]));
  assert.equal(filtered[0].rank, 1);
  assert.equal(filterRecommendations(all, [choices[0].hero.id]).length, 1);
});

test('filtering retains hero-list order and shared ranks for ties, with no preference-rank bonus', () => {
  const all = recommend(heroes, {}, enemies, 'damage');
  const ids = [all[8].hero.id, all[5].hero.id, all[2].hero.id];
  const filtered = filterRecommendations(all, ids);
  assert.deepEqual(filtered.map(row => row.hero.id), [...ids].reverse());
  assert.ok(filtered.every(row => row.rank === 1 && row.score === 0));
  assert.deepEqual(filterRecommendations(all, ['ana', 'dva', 'unknown']), []);
});

test('grades stay absolute even when preferences make a weak hero the number-one recommendation', () => {
  const all = recommend(heroes, matchups, enemies, 'damage');
  const weak = all.at(-1)!;
  const filtered = filterRecommendations(all, [weak.hero.id]);
  assert.equal(filtered[0].rank, 1);
  assert.deepEqual(gradeForScore(filtered[0].score, 'damage'), gradeForScore(weak.score, 'damage'));
  assert.notEqual(gradeForScore(filtered[0].score, 'damage').label, '매우 유리');
  assert.equal(gradeForScore(0.4, 'support').label, '중립');
  assert.equal(gradeForScore(0.4001, 'support').label, '약간 유리');
});
