import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMostRecommendations } from '../src/recommendationView.ts';
import type { Recommendation, Role } from '../src/recommend.ts';
import type { MostSelection } from '../src/most.ts';
import cuts from '../data/build/grade_cuts.json' with { type: 'json' };

const row = (id: string, score: number, rank: number, role: Role = 'damage'): Recommendation => ({ hero: { id, role, name_ko: id, portrait: '' }, score, rank });
const picks = (ids: string[], top: (string | null)[] = [null, null, null]): MostSelection => ({ ids, top: top as MostSelection['top'] });

test('unconfigured preferences recommend the top three of the selected role without extra suggestions', () => {
  const rows = [row('tank', 30, 1, 'tank'), row('a', 10, 1), row('b', 8, 2), row('c', 6, 3), row('d', 4, 4)];
  const result = selectMostRecommendations(rows, picks([]), 'damage');
  assert.deepEqual(result.primary.map(r => r.hero.id), ['a', 'b', 'c']);
  assert.ok(result.primary.every(r => !r.mostRank && !r.isPossible));
  assert.equal(result.alternative, null);
});

test('possible heroes compete with ranked most heroes by score, capped at three', () => {
  const rows = [row('outside', 20, 1), row('possible', 15, 2), row('third', 8, 3), row('first', 5, 4), row('second', -2, 5)];
  const before = structuredClone(rows);
  const result = selectMostRecommendations(rows, picks(['first', 'second', 'third', 'possible'], ['first', 'second', 'third']), 'damage');
  assert.deepEqual(result.primary.map(r => [r.hero.id, r.rank, r.mostRank, r.isPossible]), [['possible', 1, undefined, true], ['third', 2, 3, false], ['first', 3, 1, false]]);
  assert.deepEqual(rows, before);
  assert.equal(result.alternative, null);
});

test('one or two preferred heroes do not get padded with unselected heroes', () => {
  const rows = [row('outside', 20, 1), row('a', 5, 2), row('b', 2, 3)];
  for (const ids of [['a'], ['a', 'b']]) {
    assert.deepEqual(selectMostRecommendations(rows, picks(ids, ['a', null, null]), 'damage').primary.map(r => r.hero.id), ids);
  }
});

test('possible-only choices work without inventing most priorities; invalid roles are ignored', () => {
  const result = selectMostRecommendations([row('tank', 20, 1, 'tank'), row('a', 2, 1), row('b', 1, 2)], picks(['tank', 'b']), 'damage');
  assert.deepEqual(result.primary.map(r => [r.hero.id, r.mostRank, r.isPossible]), [['b', undefined, true]]);
});

for (const role of ['tank', 'damage', 'support'] as const) {
  test(`${role}: global extra suggestion appears at weakly-unfavorable cutoff and disappears immediately above it`, () => {
    const cutoff = cuts.cuts[role][2];
    const selected = picks(['a', 'b'], ['a', null, null]);
    const rows = [row('outside', 6, 1, role), row('a', cutoff, 2, role), row('b', cutoff - 1, 3, role)];
    assert.equal(selectMostRecommendations(rows, selected, role).alternative?.hero.id, 'outside');
    rows[1] = row('a', cutoff + 0.0001, 2, role);
    assert.equal(selectMostRecommendations(rows, selected, role).alternative, null);
  });
}

test('a neutral possible hero prevents extra suggestions even if every ranked most is unfavorable', () => {
  const rows = [row('outside', 10, 1), row('possible', 0, 2), row('a', -5, 3)];
  assert.equal(selectMostRecommendations(rows, picks(['a', 'possible'], ['a', null, null]), 'damage').alternative, null);
});

test('ties preserve engine order without most priority bonuses or duplicate global suggestions', () => {
  const rows = [row('possible', -5, 1), row('a', -5, 1), row('outside', -5, 1)];
  const result = selectMostRecommendations(rows, picks(['a', 'possible'], ['a', null, null]), 'damage');
  assert.deepEqual(result.primary.map(r => [r.hero.id, r.rank]), [['possible', 1], ['a', 1]]);
  assert.equal(result.alternative, null, 'global best is already in the primary recommendations');
});

test('empty engine results remain empty even with stored preferences', () => {
  assert.deepEqual(selectMostRecommendations([], picks(['a'], ['a', null, null]), 'damage'), { primary: [], alternative: null });
});
