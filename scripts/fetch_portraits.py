"""Download hero portraits from the official roster; keep internal data IDs stable."""
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlopen
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://overwatch.blizzard.com/en-us/heroes/'
SLUGS = {'freya': 'freja', 'sion': 'shion', 'junkerqueen': 'junker-queen',
         'jetpackcat': 'jetpack-cat', 'soldier76': 'soldier-76', 'wreckingball': 'wrecking-ball'}

class Roster(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.portraits = {}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a' and 'hero-card' in a.get('class', '').split():
            self.current = a['id']
        if tag == 'blz-image' and a.get('class') == 'heroCardPortrait' and self.current:
            self.portraits[self.current] = a['src']
    def handle_endtag(self, tag):
        if tag == 'a':
            self.current = None

def main():
    if len(sys.argv) > 1:
        html = Path(sys.argv[1]).read_text()
    else:
        with urlopen(SOURCE, timeout=25) as response:
            html = response.read().decode('utf-8')
    roster = Roster()
    roster.feed(html)
    heroes = json.loads((ROOT / 'data/build/heroes.json').read_text())
    manifest = {}
    def fetch(hero):
        slug = SLUGS.get(hero['id'], hero['id'])
        url = roster.portraits[slug]
        target = ROOT / 'public' / hero['portrait']
        target.parent.mkdir(parents=True, exist_ok=True)
        with urlopen(url, timeout=30) as response:
            data = response.read()
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            raise ValueError(f"Not a PNG: {hero['id']}")
        target.write_bytes(data)
        return hero['id'], {'official_slug': slug, 'source_page': SOURCE,
                            'image_url': url, 'local_path': hero['portrait']}, len(data)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(fetch, heroes))
    for hero_id, record, _ in results:
        manifest[hero_id] = record
    (ROOT / 'data/build/portrait_sources.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f"Downloaded {len(results)} portraits; {sum(n for _, _, n in results):,} bytes")

if __name__ == '__main__':
    main()
