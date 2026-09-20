import type { Recommendation, Role } from './recommend';
import type { MostSelection } from './most';
import gradeCuts from '../data/build/grade_cuts.json' with { type: 'json' };

export function gradeForScore(score: number, role: Role): { label: string; level: number } {
  const index = gradeCuts.cuts[role].findIndex(cut => score <= cut);
  const level = index < 0 ? gradeCuts.labels.length - 1 : index;
  return { label: gradeCuts.labels[level], level };
}

export function filterRecommendations(results: Recommendation[], preferredIds: readonly string[]): Recommendation[] {
  if (preferredIds.length === 0) return results;
  const allowed = new Set(preferredIds);
  const filtered = results.filter(result => allowed.has(result.hero.id));
  let rank = 0;
  return filtered.map((result, index) => {
    if (index === 0 || result.score !== filtered[index - 1].score) rank = index + 1;
    return { ...result, rank };
  });
}

export type MostRecommendation = Recommendation & { mostRank: number };

export function selectMostRecommendations(results: Recommendation[], selection: MostSelection, role: Role): {
  primary: MostRecommendation[];
  alternative: Recommendation | null;
} {
  const topIds = selection.top.filter((id): id is string => id !== null && selection.ids.includes(id));
  if (topIds.length === 0) return { primary: [], alternative: null };
  const candidates = results.filter(result => result.hero.role === role);
  const primary = filterRecommendations(candidates, topIds).map(result => ({
    ...result, mostRank: selection.top.indexOf(result.hero.id) + 1,
  }));
  const showAlternative = primary.length > 0 && primary.every(result => gradeForScore(result.score, role).level <= 4);
  const possible = new Set(selection.ids.filter(id => !topIds.includes(id)));
  // Input is already score-sorted by the engine; preserve its stable tie order.
  const alternative = showAlternative ? candidates.find(result => possible.has(result.hero.id)) ?? null : null;
  return { primary, alternative };
}
