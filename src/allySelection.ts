import { ROLE_LIMITS } from './recommend.ts';
import type { Hero, Role } from './recommend.ts';

// The player's hero is not known yet: reserve their role, not a hero ID.
export function allyRoleLimits(myRole: Role): Record<Role, number> {
  return { ...ROLE_LIMITS, [myRole]: ROLE_LIMITS[myRole] - 1 };
}

// Keep valid choices in their original order when the player's role changes.
export function reconcileAllies(selected: string[], heroes: Hero[], myRole: Role): string[] {
  const remaining = allyRoleLimits(myRole);
  const kept: string[] = [];
  for (const id of selected) {
    const hero = heroes.find(item => item.id === id);
    if (!hero || kept.includes(id) || remaining[hero.role] === 0) continue;
    remaining[hero.role]--;
    kept.push(id);
  }
  return kept;
}

export function toggleAlly(selected: string[], hero: Hero, heroes: Hero[], myRole: Role): string[] {
  const current = reconcileAllies(selected, heroes, myRole);
  if (current.includes(hero.id)) return current.filter(id => id !== hero.id);
  return reconcileAllies([...current, hero.id], heroes, myRole);
}
