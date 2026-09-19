"""Apply edited CSV scores to the JSON read by the app. Run from any directory."""
from pathlib import Path
import csv
import json
import math

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/build'
heroes = json.loads((DATA / 'heroes.json').read_text(encoding='utf-8'))
ids = {hero['name_ko']: hero['id'] for hero in heroes}
damage = {hero['id'] for hero in heroes if hero['role'] == 'damage'}
result = {}
with (DATA / 'matchups.csv').open(encoding='utf-8-sig', newline='') as stream:
    for line, row in enumerate(csv.DictReader(stream), 2):
        if row['block'] != '상성':
            continue
        source, opponent = ids[row['source_hero']], ids[row['vs_hero']]
        if source not in damage:
            raise ValueError(f'Row {line}: source is not a damage hero')
        score = float(row['score'])
        if not math.isfinite(score) or not -3 <= score <= 3:
            raise ValueError(f'Row {line}: score must be a finite number between -3 and 3')
        if opponent in result.setdefault(source, {}):
            raise ValueError(f'Row {line}: duplicate relation {source}/{opponent}')
        result[source][opponent] = score
text = json.dumps(result, ensure_ascii=False, indent=1, sort_keys=True) + '\n'
(DATA / 'matchups.json').write_text(text, encoding='utf-8')
print(f'Updated {sum(map(len, result.values()))} scores for {len(result)} damage heroes')
