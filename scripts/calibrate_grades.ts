// Reproducible offline calibration. No runtime percentile or preference-dependent grading.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { recommend, BLOCK_WEIGHT, ENEMY_WEIGHT } from '../src/recommend.ts';
import type { Hero, Matchups, MapScores, Role } from '../src/recommend.ts';

const roles: Role[] = ['tank', 'damage', 'support'];
const percentiles = [5, 20, 40, 60, 80, 95];
const labels = ['매우 불리', '불리', '약간 불리', '중립', '약간 유리', '유리', '매우 유리'];

export function calibrateGrades(heroes: Hero[], matchups: Matchups, maps: { id: string }[], mapScores: MapScores,
  { samples = 30000, seed = 20260921 } = {}) {
  if (!Number.isInteger(samples) || samples < maps.length || maps.length === 0) throw new Error('Use at least one sample per map');
  const groups = Object.fromEntries(roles.map(role => [role, heroes.filter(hero => hero.role === role).map(hero => hero.id)])) as Record<Role, string[]>;
  if (groups.tank.length < 1 || groups.damage.length < 2 || groups.support.length < 2 || new Set(heroes.map(h => h.id)).size !== heroes.length) throw new Error('Invalid hero roster');
  if (new Set(maps.map(m => m.id)).size !== maps.length) throw new Error('Duplicate maps');
  let state = seed >>> 0;
  if (!state) throw new Error('Seed must be nonzero');
  const pick = (length: number) => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return Math.floor((state >>> 0) / 4294967296 * length);
  };
  const pair = (ids: string[]) => {
    const first = pick(ids.length); let second = pick(ids.length - 1);
    if (second >= first) second++;
    return [ids[first], ids[second]];
  };
  const scores: Record<Role, number[]> = { tank: [], damage: [], support: [] };
  for (let i = 0; i < samples; i++) {
    const enemies = [groups.tank[pick(groups.tank.length)], ...pair(groups.damage), ...pair(groups.support)];
    const mapId = maps[i % maps.length].id;
    for (const role of roles) {
      for (const row of recommend(heroes, matchups, enemies, role, { mapId, mapScores })) scores[role].push(row.score);
    }
  }
  const cuts = {} as Record<Role, number[]>;
  const distribution = {} as Record<Role, { count: number; min: number; max: number; mean: number; grade_counts: number[]; grade_percentages: number[] }>;
  for (const role of roles) {
    const sorted = scores[role].sort((a, b) => a - b);
    cuts[role] = percentiles.map(p => Number(sorted[Math.ceil(sorted.length * p / 100) - 1].toFixed(2)));
    const counts = Array(7).fill(0) as number[];
    for (const score of sorted) { const grade = cuts[role].findIndex(cut => score <= cut); counts[grade < 0 ? 6 : grade]++; }
    distribution[role] = { count: sorted.length, min: sorted[0], max: sorted.at(-1)!,
      mean: Number((sorted.reduce((sum, score) => sum + score, 0) / sorted.length).toFixed(6)),
      grade_counts: counts, grade_percentages: counts.map(n => Number((100 * n / sorted.length).toFixed(3))) };
  }
  return { version: '1.5.0', labels, percentiles, samples, block_weight: BLOCK_WEIGHT, enemy_weight: ENEMY_WEIGHT, cuts,
    calibration: { seed, rng: 'xorshift32', enemy_sampling: 'uniform roles 1/2/2, without replacement within role',
      map_sampling: 'cycle all maps evenly in maps.json order', candidate_sampling: 'every hero in each role; no most filtering',
      quantile: 'nearest rank, rounded to 2 decimals; equality belongs to the lower grade',
      no_map: 'same fixed cuts; missing map contributes zero', interpretation: 'scenario-score percentiles, not win probabilities' }, distribution };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = ['heroes.json', 'matchups.json', 'maps.json', 'map_scores.json'];
  const text = Object.fromEntries(files.map(file => [file, readFileSync(new URL(`../data/build/${file}`, import.meta.url), 'utf8')]));
  const result = { ...calibrateGrades(JSON.parse(text['heroes.json']), JSON.parse(text['matchups.json']), JSON.parse(text['maps.json']), JSON.parse(text['map_scores.json'])),
    source_sha256: Object.fromEntries(files.map(file => [file, createHash('sha256').update(text[file]).digest('hex')])) };
  const output = new URL('../data/build/grade_cuts.json', import.meta.url);
  const serialized = JSON.stringify(result, null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== serialized) throw new Error('Grade calibration is stale. Run npm run grades:calibrate');
    console.log('Calibration matches current data, weights and seed.');
  } else { writeFileSync(output, serialized); console.log(JSON.stringify({ samples: result.samples, cuts: result.cuts })); }
}
