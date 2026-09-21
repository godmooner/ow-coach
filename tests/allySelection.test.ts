import test from 'node:test';
import assert from 'node:assert/strict';
import heroData from '../data/build/heroes.json' with { type: 'json' };
import { ROLE_LIMITS } from '../src/recommend.ts';
import type { Hero, Role } from '../src/recommend.ts';
import { allyRoleLimits, reconcileAllies, toggleAlly } from '../src/allySelection.ts';

const heroes = heroData as Hero[];
const roles: Role[] = ['tank', 'damage', 'support'];
const expected = {
  tank: { tank: 0, damage: 2, support: 2 },
  damage: { tank: 1, damage: 1, support: 2 },
  support: { tank: 1, damage: 2, support: 1 },
};

for (const myRole of roles) {
  test(`${myRole}: reserve the player's slot and cap teammates at the other four`, () => {
    const limits = allyRoleLimits(myRole);
    assert.deepEqual(limits, expected[myRole]);
    let selected: string[] = [];
    for (const hero of heroes) selected = toggleAlly(selected, hero, heroes, myRole);
    assert.equal(selected.length, 4);
    assert.equal(new Set(selected).size, 4);
    for (const role of roles) {
      const count = selected.filter(id => heroes.find(hero => hero.id === id)?.role === role).length;
      assert.equal(count, expected[myRole][role]);
      assert.equal(count + Number(myRole === role), ROLE_LIMITS[role]);
      for (const hero of heroes.filter(hero => hero.role === role && !selected.includes(hero.id))) {
        assert.deepEqual(toggleAlly(selected, hero, heroes, myRole), selected);
      }
    }
    const removed = heroes.find(hero => hero.id === selected[0])!;
    assert.deepEqual(toggleAlly(selected, removed, heroes, myRole), selected.slice(1));
    assert.deepEqual(toggleAlly(selected.slice(1), removed, heroes, myRole), [...selected.slice(1), removed.id]);
  });

  test(`${myRole}: changing from every other role preserves valid allies and frees the player's slot`, () => {
    for (const previousRole of roles) {
      let previous: string[] = [];
      for (const hero of heroes) previous = toggleAlly(previous, hero, heroes, previousRole);
      const snapshot = [...previous];
      const next = reconcileAllies(previous, heroes, myRole);
      assert.deepEqual(previous, snapshot);
      assert.ok(next.every(id => previous.includes(id)));
      for (const role of roles) {
        const retained = next.filter(id => heroes.find(hero => hero.id === id)?.role === role);
        const original = previous.filter(id => heroes.find(hero => hero.id === id)?.role === role);
        assert.deepEqual(retained, original.slice(0, expected[myRole][role]));
      }
      let filled = next;
      for (const hero of heroes.filter(hero => !next.includes(hero.id))) filled = toggleAlly(filled, hero, heroes, myRole);
      assert.equal(filled.length, 4);
    }
  });
}

test('invalid and repeated ally IDs are discarded without changing the source or global limits', () => {
  const selected = ['missing', 'ana', 'ana', 'mercy', 'genji', 'ashe', 'dva'];
  const snapshot = [...selected];
  assert.deepEqual(reconcileAllies(selected, heroes, 'support'), ['ana', 'genji', 'ashe', 'dva']);
  assert.deepEqual(selected, snapshot);
  assert.deepEqual(ROLE_LIMITS, { tank: 1, damage: 2, support: 2 });
  assert.deepEqual(toggleAlly([], { id: 'missing', role: 'damage', name_ko: '', portrait: '' }, heroes, 'tank'), []);
});
