import { Portrait } from './HeroVisuals';
import { formatScore } from './recommend';
import type { Recommendation } from './recommend';
import { gradeForScore } from './recommendationView';

export function RecommendationCard({ result, mostRank, isPossible = false, alternative = false, first = false }: {
  result: Recommendation;
  mostRank?: number;
  isPossible?: boolean;
  alternative?: boolean;
  first?: boolean;
}) {
  const grade = gradeForScore(result.score, result.hero.role);
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
  </article>;
}
