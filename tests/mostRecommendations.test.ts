import test from 'node:test';
import assert from 'node:assert/strict';
import { selectMostRecommendations } from '../src/recommendationView.ts';
import type { Recommendation, Role } from '../src/recommend.ts';
import type { MostSelection } from '../src/most.ts';

const selection: MostSelection = { ids: ['first', 'second', 'third', 'possible-a', 'possible-b'], top: ['first', 'second', 'third'] };
const row = (id: string, score: number, rank: number, role: Role = 'damage'): Recommendation => ({
  hero: { id, name_ko: id, role, portrait: `${id}.png` }, score, rank,
});

test('main recommendations contain only explicit most picks, keep score order and show the personal priority', () => {
  const rows = [row('unselected', 20, 1), row('possible-a', 15, 2), row('third', 8, 3), row('first', 5, 4), row('second', -2, 5)];
  const before = structuredClone(rows);
  const result = selectMostRecommendations(rows, selection, 'damage');
  assert.deepEqual(result.primary.map(r => [r.hero.id, r.score, r.rank, r.mostRank]), [
    ['third', 8, 1, 3], ['first', 5, 2, 1], ['second', -2, 3, 2],
  ]);
  assert.equal(result.alternative, null);
  assert.deepEqual(rows, before);
});

for (const [role, cutoff] of [['tank', 5.8], ['damage', 5.7], ['support', 3.7]] as const) {
  test(`${role}: the weakly-favorable boundary includes one possible pick; just above it hides the extra pick`, () => {
    const rows = [row('unselected', 20, 1, role), row('possible-a', 12, 2, role), row('possible-b', 10, 3, role),
      row('first', cutoff, 4, role), row('second', -3, 5, role), row('third', -5, 6, role)];
    assert.equal(selectMostRecommendations(rows, selection, role).alternative?.hero.id, 'possible-a');
    rows[3] = row('first', cutoff + 0.0001, 4, role);
    assert.equal(selectMostRecommendations(rows, selection, role).alternative, null);
  });
}

test('partial priorities retain their labels and tied scores retain engine order without a priority bonus', () => {
  const partial: MostSelection = { ids: ['second', 'third', 'possible-b', 'possible-a'], top: [null, 'second', 'third'] };
  const rows = [row('third', 0, 1), row('second', 0, 1), row('possible-a', -2, 3), row('possible-b', -2, 3)];
  const result = selectMostRecommendations(rows, partial, 'damage');
  assert.deepEqual(result.primary.map(r => [r.hero.id, r.rank, r.mostRank]), [['third', 1, 3], ['second', 1, 2]]);
  assert.equal(result.alternative?.hero.id, 'possible-a');
  assert.equal(result.alternative?.score, -2, 'best possible need not be better than the main picks');
});

test('empty priorities never expand to all heroes or trigger an extra pick, including select-all without priorities', () => {
  const rows = [row('first', 2, 1), row('possible-a', 0, 2)];
  for (const ids of [[], ['possible-a'], ['first', 'possible-a']]) {
    assert.deepEqual(selectMostRecommendations(rows, { ids, top: [null, null, null] }, 'damage'), { primary: [], alternative: null });
  }
  assert.deepEqual(selectMostRecommendations([], selection, 'damage'), { primary: [], alternative: null });
});

test('only selected same-role heroes are eligible; missing possible picks do not add a card', () => {
  const rows = [row('wrong-role', 20, 1, 'tank'), row('unselected', 10, 2), row('first', -4, 3)];
  const picks: MostSelection = { ids: ['first', 'wrong-role'], top: ['first', null, null] };
  const result = selectMostRecommendations(rows, picks, 'damage');
  assert.deepEqual(result.primary.map(r => r.hero.id), ['first']);
  assert.equal(result.alternative, null);
});
