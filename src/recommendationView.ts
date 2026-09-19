import type { Recommendation, Role } from './recommend';
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
