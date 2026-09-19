import type { Hero, Role } from './recommend';

export type MostRank = 1 | 2 | 3 | 4;
// ids preserves click order; top records the explicit priority buttons separately.
export type MostSelection = { ids: string[]; top: [string | null, string | null, string | null] };
export type MostByRole = Record<Role, MostSelection>;
export const PREFERRED_KEY = 'ow-coach.preferred-heroes.v1';
export const MOST_RANKS_KEY = 'ow-coach.most-ranks.v1';
const roles: Role[] = ['tank', 'damage', 'support'];

export function emptyMost(): MostSelection {
  return { ids: [], top: [null, null, null] };
}

export function emptyMostByRole(): MostByRole {
  return { tank: emptyMost(), damage: emptyMost(), support: emptyMost() };
}

export function fourthMost(selection: MostSelection): string[] {
  return selection.ids.filter(id => !selection.top.includes(id));
}

export function toggleMostHero(selection: MostSelection, heroId: string, rank: MostRank, allowedIds: readonly string[]): MostSelection {
  if (!allowedIds.includes(heroId)) return selection;
  const fourth = fourthMost(selection).filter(id => id !== heroId);
  const wasSelected = rank === 4
    ? selection.ids.includes(heroId) && !selection.top.includes(heroId)
    : selection.top[rank - 1] === heroId;
  const top = selection.top.map(id => id === heroId ? null : id) as MostSelection['top'];
  if (!wasSelected) {
    if (rank === 4) fourth.push(heroId);
    else top[rank - 1] = heroId;
  }
  const remaining = new Set([...top.filter((id): id is string => id !== null), ...fourth]);
  const ids = selection.ids.filter(id => remaining.has(id));
  for (const id of remaining) if (!ids.includes(id)) ids.push(id);
  return { ids, top };
}

export function selectAllMost(selection: MostSelection, allowedIds: readonly string[]): MostSelection {
  return { top: [...selection.top], ids: [...selection.ids, ...allowedIds.filter(id => !selection.ids.includes(id))] };
}

function readRecord(storage: Pick<Storage, 'getItem'>, key: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '{}');
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function loadMost(heroes: Hero[], storage: Pick<Storage, 'getItem'>): MostByRole {
  const preferences = readRecord(storage, PREFERRED_KEY);
  const ranks = readRecord(storage, MOST_RANKS_KEY);
  const restored = emptyMostByRole();
  for (const role of roles) {
    const allowed = new Set(heroes.filter(hero => hero.role === role).map(hero => hero.id));
    const rawIds = preferences[role];
    const ids = Array.isArray(rawIds) ? [...new Set(rawIds.filter((id): id is string => typeof id === 'string' && allowed.has(id)))] : [];
    const rawTop = Array.isArray(ranks[role]) ? ranks[role] as unknown[] : ids.slice(0, 3);
    const seen = new Set<string>();
    const top = [0, 1, 2].map(index => {
      const id = rawTop[index];
      if (typeof id !== 'string' || !ids.includes(id) || seen.has(id)) return null;
      seen.add(id);
      return id;
    }) as MostSelection['top'];
    restored[role] = { ids, top };
  }
  return restored;
}

export function saveMost(selections: MostByRole, storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(PREFERRED_KEY, JSON.stringify(Object.fromEntries(roles.map(role => [role, selections[role].ids]))));
  storage.setItem(MOST_RANKS_KEY, JSON.stringify(Object.fromEntries(roles.map(role => [role, selections[role].top]))));
}
