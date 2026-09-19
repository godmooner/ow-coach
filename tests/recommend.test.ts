import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommend, toggleHero, formatScore } from '../src/recommend.ts';
import type { Hero, Matchups } from '../src/recommend.ts';

const heroes: Hero[] = JSON.parse(readFileSync(new URL('../data/build/heroes.json', import.meta.url), 'utf8'));
const matchups: Matchups = JSON.parse(readFileSync(new URL('../data/build/matchups.json', import.meta.url), 'utf8'));

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
  const results = recommend(heroes, fixture, enemies);
  assert.equal(results.length, heroes.filter(hero => hero.role === 'damage').length);
  assert.equal(results.find(row => row.hero.id === 'genji')?.score, 7.5);
  assert.deepEqual(results, recommend(heroes, fixture, [...enemies].reverse()));
  assert.equal(formatScore(-2.5), '−2.5');
  assert.equal(formatScore(1.5), '+1.5');
});

test('missing rows stay eligible; mirror is zero; ties keep hero-list order', () => {
  const enemies = ['dmon', 'ashe', 'genji', 'ana', 'mercy'];
  const minimal: Matchups = { ashe: { ashe: 3, dmon: 0.5 } };
  const results = recommend(heroes, minimal, enemies);
  assert.equal(results.length, heroes.filter(hero => hero.role === 'damage').length);
  assert.equal(results[0].hero.id, 'ashe');
  assert.equal(results[0].score, 0.5);
  const ties = recommend(heroes, {}, enemies);
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
  assert.deepEqual(recommend(heroes, matchups, selected), []);
  assert.deepEqual(recommend(heroes, matchups, ['dva', 'ashe', 'ashe', 'ana', 'mercy']), []);
});
