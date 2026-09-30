import test from 'node:test';
import assert from 'node:assert/strict';
import heroes from '../data/build/heroes.json' with { type: 'json' };
import { recommend, scoreHero, formatScore } from '../src/recommend.ts';
import { displayContributions } from '../src/scoreBreakdown.ts';
import type { Hero, ScoringWeights } from '../src/recommend.ts';

const catalogue = heroes as Hero[];
const candidate = catalogue.find(h => h.id === 'genji')!;
const enemyIds = ['dva', 'ashe', 'bastion', 'ana', 'mercy'];
const enemies = enemyIds.map(id => catalogue.find(h => h.id === id)!);
const matchups = { genji: { dva: 2, ashe: -0.5, bastion: 1, ana: -2, mercy: 3 } };

test('contributions include both enemy-role and block weights; their total is the engine score', () => {
  const weights: ScoringWeights = {
    block: { matchup: 0.65, synergy: 0, map: 0.35 },
    enemy: { tank: { tank: 2, damage: 1, support: 1 }, damage: { tank: 3, damage: 1, support: 1 }, support: { tank: 1.5, damage: 1, support: 1 } },
  };
  const options = { mapId: 'test', mapScores: { genji: { test: -1.37 } }, weights };
  const detail = scoreHero(candidate, enemies, matchups, options);
  assert.equal(detail.contributions.matchup, 4.875);
  assert.equal(detail.contributions.map, -0.4795);
  assert.equal(detail.contributions.synergy, 0);
  assert.equal(detail.score, 4.3955);
  assert.equal(recommend(catalogue, matchups, enemyIds, 'damage', options).find(r => r.hero.id === candidate.id)?.score, detail.score);
});

test('missing map, missing relations, mirrors preserve real zero contributions', () => {
  const detail = scoreHero(candidate, enemies, matchups);
  assert.deepEqual(detail.contributions, { matchup: 4.5, synergy: 0, map: 0 });
  const mirror = scoreHero(candidate, [candidate], { genji: { genji: 3 } });
  assert.equal(mirror.score, 0);
  assert.deepEqual(mirror.contributions, { matchup: 0, synergy: 0, map: 0 });
  assert.equal(scoreHero(candidate, enemies, {}, { mapId: 'missing', mapScores: {} }).score, 0);
});

test('displayed terms add up to the displayed total across positive/negative rounding edges', () => {
  assert.equal(formatScore(-0.004), '0');
  assert.equal(formatScore(0.004), '0');
  for (const map of [0, 0.005, -0.005, 0.0049, 1.375, -1.375, 0.9999]) {
    for (const matchup of [0, 0.005, -0.005, 4.875, -4.875, -0.0049]) {
      const total = Number((map + matchup).toFixed(12));
      const display = displayContributions(total, { map, matchup, synergy: 0 });
      const sum = Number((display.map + display.matchup + display.synergy).toFixed(2));
      assert.equal(formatScore(sum), formatScore(total));
      assert.equal(display.synergy, 0);
      assert.ok(Math.abs(display.matchup - matchup) <= 0.0100001);
      assert.ok(Math.abs(display.map - map) <= 0.0050001);
    }
  }
});
