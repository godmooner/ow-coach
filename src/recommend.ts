export type Role = 'tank' | 'damage' | 'support';
export type Hero = { id: string; name_ko: string; role: Role; portrait: string };
export type Matchups = Record<string, Record<string, number>>;
export type Recommendation = { hero: Hero; score: number; rank: number };
export const ROLE_LIMITS: Record<Role, number> = { tank: 1, damage: 2, support: 2 };
export const ENEMY_WEIGHT: Record<Role, Record<Role, number>> = {
  tank: { tank: 3, damage: 1, support: 1 },
  damage: { tank: 2, damage: 1, support: 1 },
  support: { tank: 2, damage: 1, support: 1 },
};

export function toggleHero(selected: string[], hero: Hero, heroes: Hero[]): string[] {
  if (selected.includes(hero.id)) return selected.filter(id => id !== hero.id);
  const count = selected.filter(id => heroes.find(item => item.id === id)?.role === hero.role).length;
  return count < ROLE_LIMITS[hero.role] ? [...selected, hero.id] : selected;
}

export function recommend(heroes: Hero[], matchups: Matchups, enemyIds: string[], myRole: Role): Recommendation[] {
  if (enemyIds.length !== 5 || new Set(enemyIds).size !== 5) return [];
  const enemies = enemyIds.map(id => heroes.find(hero => hero.id === id));
  if (enemies.some(hero => !hero)) return [];
  if ((Object.keys(ROLE_LIMITS) as Role[]).some(role =>
    enemies.filter(hero => hero?.role === role).length !== ROLE_LIMITS[role])) return [];

  // Keep every hero in the selected role, even if some or all relations are missing.
  const sorted = heroes.filter(hero => hero.role === myRole).map((hero, order) => ({
    hero, order,
    score: enemyIds.reduce((sum, enemyId, index) =>
      sum + ENEMY_WEIGHT[myRole][enemies[index]!.role] * (hero.id === enemyId ? 0 : matchups[hero.id]?.[enemyId] ?? 0), 0),
  })).sort((a, b) => b.score - a.score || a.order - b.order);

  let rank = 0;
  return sorted.map((item, index) => {
    if (index === 0 || item.score !== sorted[index - 1].score) rank = index + 1;
    return { hero: item.hero, score: item.score, rank };
  });
}

export function formatScore(score: number): string {
  const value = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(Math.abs(score));
  return score > 0 ? `+${value}` : score < 0 ? `−${value}` : '0';
}
