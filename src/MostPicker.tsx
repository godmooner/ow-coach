import { useState } from 'react';
import { Portrait } from './HeroVisuals';
import { emptyMost, fourthMost, selectAllMost, toggleMostHero } from './most';
import type { MostRank, MostSelection } from './most';
import type { Hero } from './recommend';

const ranks: MostRank[] = [1, 2, 3, 4];

export function MostPicker({ heroes, roleName, selection, storageAvailable, onChange, onComplete }: {
  heroes: Hero[];
  roleName: string;
  selection: MostSelection;
  storageAvailable: boolean;
  onChange: (selection: MostSelection) => void;
  onComplete: () => void;
}) {
  const [activeRank, setActiveRank] = useState<MostRank>(() => {
    const missing = selection.top.findIndex(id => id === null);
    return missing < 0 ? 4 : (missing + 1) as MostRank;
  });
  const allowedIds = heroes.map(hero => hero.id);
  const count = selection.ids.length;
  const fourth = fourthMost(selection);
  const choose = (hero: Hero) => {
    const next = toggleMostHero(selection, hero.id, activeRank, allowedIds);
    onChange(next);
    if (activeRank !== 4 && next.top[activeRank - 1] === hero.id) {
      const missing = next.top.findIndex(id => id === null);
      setActiveRank(missing < 0 ? 4 : (missing + 1) as MostRank);
    }
  };

  return <main className="most-selection" aria-labelledby="most-title">
    <div className="section-heading most-heading">
      <div><span className="eyebrow">YOUR MOST PICKS</span><h1 id="most-title">내 모스트 선택</h1></div>
      <span className="most-count">{roleName} {count} / {heroes.length}명</span>
    </div>
    <p className="most-description">다룰 줄 아는 영웅을 골라주세요. 1~3순위는 각 1명, 4순위는 여러 명을 선택할 수 있습니다. 비워 둔 순위가 있어도 완료할 수 있습니다.</p>

    <div className="most-ranks" role="group" aria-label="모스트 순위 선택">
      {ranks.map(rank => <button key={rank} type="button" aria-label={`${rank}순위 선택`}
        aria-pressed={activeRank === rank} className={`most-rank ${activeRank === rank ? 'active' : ''}`}
        onClick={() => setActiveRank(rank)}>
        <span className="most-rank-label">{rank}순위<span>{rank === 4 ? '여러 명 선택 가능' : '최대 1명'}</span></span>
        <span className="most-rank-name">{rank === 4 ? `${fourth.length}명 선택` : heroes.find(hero => hero.id === selection.top[rank - 1])?.name_ko ?? '영웅을 골라주세요'}</span>
      </button>)}
    </div>

    <div className="most-toolbar">
      <p aria-live="polite"><strong>{activeRank}순위</strong> 선택 중</p>
      <div className="most-actions">
        <button className="reset-button" type="button" data-testid="most-select-all"
          onClick={() => onChange(selectAllMost(selection, allowedIds))}>전체 선택</button>
        <button className="reset-button" type="button" data-testid="most-clear" disabled={count === 0}
          onClick={() => { onChange(emptyMost()); setActiveRank(1); }}>전체 해제</button>
      </div>
    </div>
    <p className="most-help">순위를 선택한 뒤 초상화를 누르세요. 다른 순위의 영웅은 현재 순위로 이동하고, 같은 순위의 영웅은 해제됩니다.</p>
    <div className="hero-grid most-hero-grid">
      {heroes.map(hero => {
        const topIndex = selection.top.indexOf(hero.id);
        const assignedRank = topIndex >= 0 ? topIndex + 1 : selection.ids.includes(hero.id) ? 4 : null;
        return <button key={hero.id} type="button" data-hero-id={hero.id}
          className={`hero-button ${assignedRank ? 'selected' : ''}`} aria-label={hero.name_ko} aria-pressed={assignedRank !== null}
          aria-description={assignedRank ? `모스트 ${assignedRank}순위` : '선택 안 됨'}
          onClick={() => choose(hero)}>
          <Portrait hero={hero} />
          {assignedRank && <span className="most-rank-badge">{assignedRank}순위</span>}
          <span className="hero-name">{hero.name_ko}</span>
        </button>;
      })}
    </div>
    <p className="most-help">전체 선택은 정해 둔 1~3순위를 유지하고, 나머지 영웅을 모두 4순위에 넣습니다.</p>

    <div className="most-bottom">
      <div><p aria-live="polite">{count ? `선택한 ${count}명 안에서 추천합니다.` : '선택하지 않으면 역할군 전체에서 추천합니다.'}</p>
        <p className="most-help">모스트 순위에 따른 가산점은 없습니다.{storageAvailable && ' 선택은 이 브라우저에 저장됩니다.'}</p>
        {!storageAvailable && <p className="most-help storage-notice" role="status">브라우저 저장을 사용할 수 없어 이번 페이지에서만 선택이 유지됩니다.</p>}</div>
      <div className="most-bottom-actions">
        <button className="reset-button" type="button" data-testid="most-skip"
          onClick={() => { onChange(emptyMost()); onComplete(); }}>선택 없이 건너뛰기</button>
        <button className="complete-button" type="button" data-testid="most-complete" onClick={onComplete}>완료</button>
      </div>
    </div>
  </main>;
}

export function MostSummary({ heroes, selection, onEdit }: {
  heroes: Hero[];
  selection: MostSelection;
  onEdit: () => void;
}) {
  const name = (id: string | null) => heroes.find(hero => hero.id === id)?.name_ko ?? '미선택';
  const fourth = fourthMost(selection);
  return <section className="most-summary" aria-label="내 모스트" data-testid="most-summary">
    <div className="most-summary-heading"><strong>내 모스트 {selection.ids.length ? `· ${selection.ids.length}명 안에서 추천` : '· 전체 후보'}</strong>
      <button className="reset-button" type="button" data-testid="most-edit" onClick={onEdit}>모스트 수정</button></div>
    {selection.ids.length ? <div className="most-summary-list">
      {selection.top.map((id, index) => <p key={index}><strong>{index + 1}순위</strong> {name(id)}</p>)}
      <p className="most-summary-fourth"><strong>4순위</strong> {fourth.length ? fourth.map(name).join(', ') : '없음'}</p>
    </div> : <p className="most-help">선택한 모스트가 없어 역할군 전체에서 추천합니다.</p>}
  </section>;
}
