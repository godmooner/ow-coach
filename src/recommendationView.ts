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

export type MostRecommendation = Recommendation & { mostRank?: number; isPossible: boolean };

export function selectMostRecommendations(results: Recommendation[], selection: MostSelection, role: Role): {
  primary: MostRecommendation[];
  alternative: Recommendation | null;
} {
  const candidates = results.filter(result => result.hero.role === role);
  const preferredIds = candidates.filter(result => selection.ids.includes(result.hero.id)).map(result => result.hero.id);
  const configured = preferredIds.length > 0;
  const primary = filterRecommendations(candidates, preferredIds).slice(0, 3).map(result => {
    const topIndex = configured ? selection.top.indexOf(result.hero.id) : -1;
    return { ...result, mostRank: topIndex < 0 ? undefined : topIndex + 1, isPossible: configured && topIndex < 0 };
  });
  const showAlternative = configured && primary.length > 0 && primary.every(result => gradeForScore(result.score, role).level <= 2);
  // Input is already score-sorted by the engine; preserve its stable tie order.
  const best = candidates[0];
  const alternative = showAlternative && best && !primary.some(result => result.hero.id === best.hero.id) ? best : null;
  return { primary, alternative };
}
