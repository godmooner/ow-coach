"""Validate and apply the full, all-role matchup CSV. Never write a partial import."""
from pathlib import Path
import argparse
import csv
import json
import math

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'data/build')
DATA = parser.parse_args().data_dir
heroes = json.loads((DATA / 'heroes.json').read_text(encoding='utf-8'))
ids = {hero['name_ko']: hero['id'] for hero in heroes}
current = json.loads((DATA / 'matchups.json').read_text(encoding='utf-8'))
result = {}
with (DATA / 'matchups.csv').open(encoding='utf-8-sig', newline='') as stream:
    for line, row in enumerate(csv.DictReader(stream), 2):
        if row['block'] != '상성':
            continue
        source, opponent = ids[row['source_hero']], ids[row['vs_hero']]
        if source == opponent:
            raise ValueError(f'Row {line}: mirror scores are fixed at zero; omit this row')
        score = float(row['score'])
        if not math.isfinite(score) or not -3 <= score <= 3:
            raise ValueError(f'Row {line}: score must be a finite number between -3 and 3')
        if opponent in result.setdefault(source, {}):
            raise ValueError(f'Row {line}: duplicate relation {source}/{opponent}')
        result[source][opponent] = score
if set(result) != set(ids.values()):
    raise ValueError('CSV must contain all hero rows, including tanks and supports')
missing = [(source, target) for source, row in current.items() for target in row if target not in result.get(source, {})]
if missing:
    raise ValueError(f'CSV is missing {len(missing)} existing relations; JSON was not changed')
text = json.dumps(result, ensure_ascii=False, indent=1, sort_keys=True) + '\n'
temporary = DATA / 'matchups.json.tmp'
temporary.write_text(text, encoding='utf-8')
temporary.replace(DATA / 'matchups.json')
print(f'Updated {sum(map(len, result.values()))} scores for {len(result)} heroes; run npm run grades:calibrate next')
