import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Hero } from '../src/recommend.ts';

test('CSV conversion round-trips all roles and refuses partial data without overwriting JSON', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ow-csv-'));
  try {
    for (const file of ['heroes.json', 'matchups.json', 'matchups.csv']) cpSync(new URL(`../data/build/${file}`, import.meta.url), path.join(dir, file));
    const before = readFileSync(path.join(dir, 'matchups.json'), 'utf8');
    const run = () => spawnSync('python3', [new URL('../scripts/csv_to_json.py', import.meta.url).pathname, '--data-dir', dir], { encoding: 'utf8' });
    const full = run();
    assert.equal(full.status, 0, full.stderr);
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'matchups.json'), 'utf8')), JSON.parse(before));
    const good = readFileSync(path.join(dir, 'matchups.json'), 'utf8');
    const csv = readFileSync(path.join(dir, 'matchups.csv'), 'utf8');
    writeFileSync(path.join(dir, 'matchups.csv'), csv.split('\n').slice(0, 100).join('\n'));
    const partial = run();
    assert.notEqual(partial.status, 0);
    assert.equal(readFileSync(path.join(dir, 'matchups.json'), 'utf8'), good);
    // A bad score must also fail atomically, before changing any relation.
    writeFileSync(path.join(dir, 'matchups.csv'), csv.replace(/(,상성,[^,]+,)[^,]+/, '$1NaN'));
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(path.join(dir, 'matchups.json'), 'utf8'), good);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('calibration uses pooled candidate scores, with deterministic fixed quantiles', async () => {
  const moduleUrl = new URL('../scripts/calibrate_grades.ts', import.meta.url);
  assert.ok(existsSync(moduleUrl), 'Reproducible calibration script must be supplied');
  const { calibrateGrades } = await import(moduleUrl.href);
  const heroes: Hero[] = [
    { id: 't', role: 'tank', name_ko: 't', portrait: '' },
    { id: 'd1', role: 'damage', name_ko: 'd1', portrait: '' }, { id: 'd2', role: 'damage', name_ko: 'd2', portrait: '' },
    { id: 's1', role: 'support', name_ko: 's1', portrait: '' }, { id: 's2', role: 'support', name_ko: 's2', portrait: '' },
  ];
  const matchups = { t: { d1: 0.5, d2: 0.5, s1: 0.5, s2: 0.5 }, d1: { t: 2, d2: -1, s1: 1 } };
  const options = { samples: 20, seed: 15 };
  const result = calibrateGrades(heroes, matchups, [{ id: 'map' }], { d1: { map: 1 } }, options);
  // Every team is the same five heroes: tank 2; damage candidates 3.6 and 0.
  assert.deepEqual(result.cuts.tank, [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(result.cuts.damage, [0, 0, 0, 3.6, 3.6, 3.6]);
  assert.equal(result.distribution.damage.count, 40);
  assert.equal(result.distribution.damage.mean, 1.8);
  assert.deepEqual(result, calibrateGrades(heroes, matchups, [{ id: 'map' }], { d1: { map: 1 } }, options));
});
