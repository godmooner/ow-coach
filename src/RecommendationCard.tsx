import { Portrait } from './HeroVisuals';
import { formatScore } from './recommend';
import type { Recommendation } from './recommend';
import { gradeForScore } from './recommendationView';

export function RecommendationCard({ result, mostRank, first = false }: {
  result: Recommendation;
  mostRank?: number;
  first?: boolean;
}) {
  const grade = gradeForScore(result.score, result.hero.role);
  return <article className={`result-card ${first ? 'first' : ''}`}
    data-result-id={result.hero.id} data-score={result.score} data-result-kind={mostRank ? 'most' : 'possible'}>
    <div className="result-portrait"><Portrait key={result.hero.id} hero={result.hero} />
      {mostRank && <span className="rank">{String(result.rank).padStart(2, '0')}</span>}
    </div>
    <div className="result-name"><span>{mostRank ? first ? '추천 픽' : '다른 선택' : '가능 중 최고 점수'}</span>
      <h3>{result.hero.name_ko} <span className="result-most-label">{mostRank ? `모스트 ${mostRank}순위` : '가능'}</span></h3>
    </div>
    <div className="result-grade">
      <strong className={`grade-label grade-${grade.level}`} data-testid="grade">{grade.label}</strong>
      <span className="score">{formatScore(result.score)}<span>점</span></span>
    </div>
  </article>;
}
