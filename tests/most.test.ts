import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyMost, emptyMostByRole, toggleMostHero, selectAllMost, fourthMost, loadMost, saveMost, PREFERRED_KEY, MOST_RANKS_KEY } from '../src/most.ts';
import type { MostSelection } from '../src/most.ts';
import type { Hero } from '../src/recommend.ts';

const heroes: Hero[] = JSON.parse(readFileSync(new URL('../data/build/heroes.json', import.meta.url), 'utf8'));
const damageIds = heroes.filter(hero => hero.role === 'damage').map(hero => hero.id);
const ranked = (): MostSelection => ({ ids: ['genji', 'ashe', 'cassidy', 'tracer'], top: ['genji', 'ashe', 'cassidy'] });
const memoryStorage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

test('empty and partial selections stay representable; each priority holds at most one hero', () => {
  let selection = emptyMost();
  assert.deepEqual(selection, { ids: [], top: [null, null, null] });
  for (const [index, id] of ['genji', 'ashe', 'cassidy'].entries()) {
    selection = toggleMostHero(selection, id, (index + 1) as 1 | 2 | 3, damageIds);
    assert.equal(selection.ids.length, index + 1);
  }
  assert.deepEqual(selection, { ids: ['genji', 'ashe', 'cassidy'], top: ['genji', 'ashe', 'cassidy'] });
  assert.deepEqual(fourthMost(selection), []);
});

test('replacing a priority preserves click order, other picks and the original state', () => {
  const previous = ranked();
  const next = toggleMostHero(previous, 'hanzo', 1, damageIds);
  assert.deepEqual(next, { ids: ['ashe', 'cassidy', 'tracer', 'hanzo'], top: ['hanzo', 'ashe', 'cassidy'] });
  assert.deepEqual(fourthMost(next), ['tracer']);
  assert.deepEqual(previous, ranked());
});

test('moving a hero between priorities never duplicates or reorders a retained selection', () => {
  let selection = toggleMostHero(ranked(), 'genji', 2, damageIds);
  assert.deepEqual(selection, { ids: ['genji', 'cassidy', 'tracer'], top: [null, 'genji', 'cassidy'] });
  selection = toggleMostHero(selection, 'tracer', 1, damageIds);
  assert.deepEqual(selection, { ids: ['genji', 'cassidy', 'tracer'], top: ['tracer', 'genji', 'cassidy'] });
  selection = toggleMostHero(selection, 'genji', 4, damageIds);
  assert.deepEqual(selection, { ids: ['genji', 'cassidy', 'tracer'], top: ['tracer', null, 'cassidy'] });
  assert.deepEqual(fourthMost(selection), ['genji']);
});

test('deselecting and reselecting appends the hero to the selection order', () => {
  for (const [rank, id] of [[1, 'genji'], [2, 'ashe'], [3, 'cassidy'], [4, 'tracer']] as const) {
    const removed = toggleMostHero(ranked(), id, rank, damageIds);
    assert.ok(!removed.ids.includes(id));
    assert.ok(!removed.top.includes(id));
    assert.equal(removed.ids.length, 3);
    const added = toggleMostHero(removed, id, rank, damageIds);
    assert.equal(added.ids.at(-1), id);
  }
});

test('fourth priority accepts all remaining heroes without a count limit', () => {
  let selection: MostSelection = { ids: ['genji', 'ashe', 'cassidy'], top: ['genji', 'ashe', 'cassidy'] };
  const remaining = damageIds.filter(id => !selection.top.includes(id));
  for (const id of remaining) selection = toggleMostHero(selection, id, 4, damageIds);
  assert.equal(fourthMost(selection).length, 21);
  assert.deepEqual(selection.ids, ['genji', 'ashe', 'cassidy', ...remaining]);
});

test('select all preserves the first three priorities and click order, adding the rest to fourth', () => {
  const previous = ranked();
  const all = selectAllMost(previous, damageIds);
  assert.deepEqual(all.top, previous.top);
  assert.deepEqual(all.ids, [...previous.ids, ...damageIds.filter(id => !previous.ids.includes(id))]);
  assert.equal(new Set(all.ids).size, 24);
  assert.equal(fourthMost(all).length, 21);
  assert.deepEqual(selectAllMost(all, damageIds), all);
  assert.deepEqual(previous, ranked());
});

test('select all before ranking never invents priorities and still allows promotion', () => {
  let selection = selectAllMost(emptyMost(), damageIds);
  assert.deepEqual(selection, { ids: damageIds, top: [null, null, null] });
  selection = toggleMostHero(selection, 'genji', 1, damageIds);
  assert.equal(selection.top[0], 'genji');
  assert.deepEqual(selection.ids, damageIds);
  assert.equal(fourthMost(selection).length, 23);
});

test('heroes outside the selected role and unknown heroes cannot be selected', () => {
  for (const id of ['dva', 'ana', 'unknown']) {
    assert.deepEqual(toggleMostHero(ranked(), id, 1, damageIds), ranked());
    assert.deepEqual(toggleMostHero(ranked(), id, 4, damageIds), ranked());
  }
});

test('storage keeps ordered arrays per role and restores explicit priority choices separately', () => {
  const storage = memoryStorage();
  const selections = emptyMostByRole();
  selections.damage = toggleMostHero(ranked(), 'tracer', 1, damageIds);
  selections.tank = { ids: ['dva'], top: [null, null, 'dva'] };
  saveMost(selections, storage);
  assert.deepEqual(JSON.parse(storage.getItem(PREFERRED_KEY)!), { tank: ['dva'], damage: ['ashe', 'cassidy', 'tracer'], support: [] });
  assert.deepEqual(loadMost(heroes, storage), selections);
});

test('restoring storage drops unknown, duplicate and wrong-role IDs without changing valid order', () => {
  const storage = memoryStorage();
  storage.setItem(PREFERRED_KEY, JSON.stringify({ damage: ['tracer', 'ana', 'tracer', 5, 'unknown', 'genji'], tank: ['dva'], support: 'ana' }));
  storage.setItem(MOST_RANKS_KEY, JSON.stringify({ damage: ['genji', 'genji', 'ana'] }));
  const restored = loadMost(heroes, storage);
  assert.deepEqual(restored.damage, { ids: ['tracer', 'genji'], top: ['genji', null, null] });
  assert.deepEqual(restored.tank, { ids: ['dva'], top: ['dva', null, null] });
  assert.deepEqual(restored.support, emptyMost());
});

test('corrupt storage falls back safely and corrupt priority metadata does not erase preferences', () => {
  const storage = memoryStorage();
  storage.setItem(PREFERRED_KEY, '{bad');
  assert.deepEqual(loadMost(heroes, storage), emptyMostByRole());
  storage.setItem(PREFERRED_KEY, JSON.stringify({ damage: ['tracer', 'genji'] }));
  storage.setItem(MOST_RANKS_KEY, '{bad');
  assert.deepEqual(loadMost(heroes, storage).damage, { ids: ['tracer', 'genji'], top: ['tracer', 'genji', null] });
});
