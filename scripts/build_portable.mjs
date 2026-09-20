// Package the same built React app with local portraits for double-click use.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const scriptMatch = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const styleMatch = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!scriptMatch || !styleMatch) throw new Error('Run npm run build before npm run portable.');
const readAsset = relative => fs.readFileSync(path.join(root, 'dist', relative), 'utf8');
const heroes = JSON.parse(fs.readFileSync(path.join(root, 'data/build/heroes.json'), 'utf8'));
const portraits = Object.fromEntries(heroes.map(hero => [hero.id,
  `data:image/png;base64,${fs.readFileSync(path.join(root, 'public', hero.portrait)).toString('base64')}`]));
const maps = JSON.parse(fs.readFileSync(path.join(root, 'data/build/maps.json'), 'utf8'));
const mapThumbnails = Object.fromEntries(maps.flatMap(map => {
  const file = path.join(root, 'public/maps', `${map.id}.webp`);
  return fs.existsSync(file) ? [[map.id, `data:image/webp;base64,${fs.readFileSync(file).toString('base64')}`]] : [];
}));
const script = readAsset(scriptMatch[1]).replaceAll('</script', '<\\/script');
// A classic inline script works from file:// and uses the same compiled app.
html = html.replace(scriptMatch[0], '');
html = html.replace('</body>', () => `<script>window.__OW_PORTRAITS__=${JSON.stringify(portraits)};window.__OW_MAPS__=${JSON.stringify(mapThumbnails)};</script>\n<script>${script}</script>\n</body>`);
html = html.replace(styleMatch[0], () => `<style>${readAsset(styleMatch[1]).replace(/@import\s+(?:url\([^)]+\)|"[^"]*"|'[^']*')[^;]*;/g, '')}</style>`);
const favicon = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
html = html.replace(/href="\.\/favicon\.svg"/, `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
const fontLicense = fs.readFileSync(path.join(root, 'public/licenses/OFL_NotoSansKR.txt'), 'utf8');
html = html.replace('</body>', `<script type="text/plain" id="font-license">${fontLicense}</script>\n</body>`);
const out = path.join(root, 'release');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'OW_Coach.html'), html);
console.log(`release/OW_Coach.html (${Buffer.byteLength(html).toLocaleString()} bytes)`);
