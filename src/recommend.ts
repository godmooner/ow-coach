export type Role = 'tank' | 'damage' | 'support';
export type Hero = { id: string; name_ko: string; role: Role; portrait: string };
export type Matchups = Record<string, Record<string, number>>;
export type MapScores = Record<string, Record<string, number>>;
export type ScoreBlocks = { matchup: number; synergy: number; map: number };
export type ScoringWeights = { block: ScoreBlocks; enemy: Record<Role, Record<Role, number>> };
export type RecommendationOptions = { mapId?: string | null; mapScores?: MapScores; weights?: ScoringWeights };
export type Recommendation = { hero: Hero; score: number; rank: number };
export const ROLE_LIMITS: Record<Role, number> = { tank: 1, damage: 2, support: 2 };
export const BLOCK_WEIGHT: ScoreBlocks = { matchup: 1, synergy: 0, map: 0.6 };
export const ENEMY_WEIGHT: Record<Role, Record<Role, number>> = {
  tank: { tank: 2, damage: 1, support: 1 },
  damage: { tank: 1.5, damage: 1, support: 1 },
  support: { tank: 1.5, damage: 1, support: 1 },
};

export function toggleHero(selected: string[], hero: Hero, heroes: Hero[]): string[] {
  if (selected.includes(hero.id)) return selected.filter(id => id !== hero.id);
  const count = selected.filter(id => heroes.find(item => item.id === id)?.role === hero.role).length;
  return count < ROLE_LIMITS[hero.role] ? [...selected, hero.id] : selected;
}

export function combineScoreBlocks(blocks: ScoreBlocks, weights: ScoreBlocks = BLOCK_WEIGHT): number {
  const total = weights.matchup * blocks.matchup + weights.synergy * blocks.synergy + weights.map * blocks.map;
  // Remove floating-point noise from decimal sliders; do not round to display precision.
  return Number(total.toFixed(12));
}

export function scoreHero(hero: Hero, enemies: Hero[], matchups: Matchups, options: RecommendationOptions = {}): {
  score: number; contributions: ScoreBlocks;
} {
  const blockWeight = options.weights?.block ?? BLOCK_WEIGHT;
  const enemyWeight = options.weights?.enemy ?? ENEMY_WEIGHT;
  const blocks: ScoreBlocks = {
    matchup: enemies.reduce((sum, enemy) => sum + enemyWeight[hero.role][enemy.role] *
      (hero.id === enemy.id ? 0 : matchups[hero.id]?.[enemy.id] ?? 0), 0),
    synergy: 0, // Ally data is not connected yet.
    map: options.mapId ? options.mapScores?.[hero.id]?.[options.mapId] ?? 0 : 0,
  };
  return {
    score: combineScoreBlocks(blocks, blockWeight),
    contributions: {
      matchup: blockWeight.matchup * blocks.matchup,
      synergy: blockWeight.synergy * blocks.synergy,
      map: blockWeight.map * blocks.map,
    },
  };
}

export function recommend(heroes: Hero[], matchups: Matchups, enemyIds: string[], myRole: Role, options: RecommendationOptions = {}): Recommendation[] {
  if (enemyIds.length !== 5 || new Set(enemyIds).size !== 5) return [];
  const enemies = enemyIds.map(id => heroes.find(hero => hero.id === id));
  if (enemies.some(hero => !hero)) return [];
  if ((Object.keys(ROLE_LIMITS) as Role[]).some(role =>
    enemies.filter(hero => hero?.role === role).length !== ROLE_LIMITS[role])) return [];

  // Keep every hero in the selected role, even if some or all relations are missing.
  const sorted = heroes.filter(hero => hero.role === myRole).map((hero, order) => {
    return { hero, order, score: scoreHero(hero, enemies as Hero[], matchups, options).score };
  }).sort((a, b) => b.score - a.score || a.order - b.order);

  let rank = 0;
  return sorted.map((item, index) => {
    if (index === 0 || item.score !== sorted[index - 1].score) rank = index + 1;
    return { hero: item.hero, score: item.score, rank };
  });
}

export function formatScore(score: number): string {
  const value = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(Math.abs(score));
  if (value === '0') return '0';
  return score > 0 ? `+${value}` : score < 0 ? `−${value}` : '0';
}
