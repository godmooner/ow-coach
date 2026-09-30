import { Portrait } from './HeroVisuals';
import { formatScore } from './recommend';
import type { Recommendation, ScoreBlocks } from './recommend';
import { gradeForScore } from './recommendationView';
import { displayContributions } from './scoreBreakdown';

export function RecommendationCard({ result, contributions, mostRank, isPossible = false, alternative = false, first = false }: {
  result: Recommendation;
  contributions: ScoreBlocks;
  mostRank?: number;
  isPossible?: boolean;
  alternative?: boolean;
  first?: boolean;
}) {
  const grade = gradeForScore(result.score, result.hero.role);
  const display = displayContributions(result.score, contributions);
  return <article className={`result-card ${first ? 'first' : ''}`}
    data-result-id={result.hero.id} data-score={result.score} data-result-kind={alternative ? 'alternative' : 'primary'}>
    <div className="result-portrait"><Portrait key={result.hero.id} hero={result.hero} />
      {!alternative && <span className="rank">{String(result.rank).padStart(2, '0')}</span>}
    </div>
    <div className="result-name"><span>{alternative ? '전체 영웅 중 최고 점수' : first ? '추천 픽' : '다른 선택'}</span>
      <h3>{result.hero.name_ko} {(mostRank || isPossible) && <span className="result-most-label">{mostRank ? `모스트 ${mostRank}순위` : '가능'}</span>}</h3>
    </div>
    <div className="result-grade">
      <strong className={`grade-label grade-${grade.level}`} data-testid="grade">{grade.label}</strong>
      <span className="score">{formatScore(result.score)}<span>점</span></span>
    </div>
    <div className="score-breakdown" aria-label="가중치 적용 후 점수 기여도"
      title="가중치 적용 후 점수입니다. 표시 합계가 총점과 같도록 소수점 둘째 자리에서 반올림합니다. 아군 궁합은 현재 미반영(0점)입니다.">
      <span data-score-part="map" data-part-value={display.map}>전장 <strong>{formatScore(display.map)}</strong></span>
      <span data-score-part="matchup" data-part-value={display.matchup}>상대 <strong>{formatScore(display.matchup)}</strong></span>
      <span data-score-part="synergy" data-part-value={display.synergy}>아군 <strong>{formatScore(display.synergy)}</strong></span>
    </div>
  </article>;
}
