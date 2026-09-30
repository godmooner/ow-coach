import type { ScoreBlocks } from './recommend';

const displayNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false });
const cents = (value: number) => Math.round(Number(displayNumber.format(value)) * 100);

// Round only for display. Reconcile the opponent term in integer cents so the
// three printed terms sum to the same rounded total printed on the card.
export function displayContributions(total: number, contributions: ScoreBlocks): ScoreBlocks {
  const map = cents(contributions.map);
  const synergy = cents(contributions.synergy);
  return { map: map / 100, synergy: synergy / 100, matchup: (cents(total) - map - synergy) / 100 };
}
