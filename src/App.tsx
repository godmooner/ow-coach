import { useEffect, useState } from 'react';
import heroData from '../data/build/heroes.json';
import matchupData from '../data/build/matchups.json';
import mapData from '../data/build/maps.json';
import mapScoreData from '../data/build/map_scores.json';
import { recommend, toggleHero } from './recommend';
import type { Hero, Role, Matchups, MapScores } from './recommend';
import { RoleIcon } from './HeroVisuals';
import { MostPicker, MostSummary } from './MostPicker';
import { emptyMostByRole, loadMost, saveMost } from './most';
import { selectMostRecommendations } from './recommendationView';
import { RecommendationCard } from './RecommendationCard';
import { MapPicker } from './MapPicker';
import { TeamPicker } from './TeamPicker';
import { reconcileAllies, toggleAlly } from './allySelection';
import { WeightSettings } from './WeightSettings';
import { defaultWeights, loadWeights, saveWeights } from './weights';

const heroes = heroData as Hero[];
const matchups: Matchups = matchupData;
const mapScores: MapScores = mapScoreData;
const roles: Role[] = ['tank', 'damage', 'support'];
type ActiveInput = 'map' | 'enemy' | 'ally' | null;
const roleNames: Record<Role, string> = { tank: '탱커', damage: '딜러', support: '힐러' };

export default function App() {
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [editingMostRole, setEditingMostRole] = useState<Role | null>(null);
  const [activeInput, setActiveInput] = useState<ActiveInput>('map');
  const [allyIds, setAllyIds] = useState<string[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const selectedMap = mapData.find(map => map.id === selectedMapId);
  const [weights, setWeights] = useState(() => {
    try { return loadWeights(window.localStorage); }
    catch { return defaultWeights(); }
  });
  const [weightStorageAvailable, setWeightStorageAvailable] = useState(true);
  useEffect(() => {
    try { saveWeights(weights, window.localStorage); setWeightStorageAvailable(true); }
    catch { setWeightStorageAvailable(false); }
  }, [weights]);
  const [mostByRole, setMostByRole] = useState(() => {
    try { return loadMost(heroes, window.localStorage); }
    catch { return emptyMostByRole(); }
  });
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try { saveMost(mostByRole, window.localStorage); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [mostByRole]);
  const [selected, setSelected] = useState<string[]>([]);
  const candidateCount = myRole ? mostByRole[myRole].ids.length || heroes.filter(hero => hero.role === myRole).length : 0;
  const { primary: results, alternative } = myRole ? selectMostRecommendations(recommend(heroes, matchups, selected, myRole,
    { mapId: selectedMapId, mapScores, weights }), mostByRole[myRole], myRole) : { primary: [], alternative: null };
  const complete = selected.length === 5;
  const chooseEnemy = (hero: Hero) => {
    const next = toggleHero(selected, hero, heroes);
    setSelected(next);
    setActiveInput(next.length === 5 ? null : 'enemy');
  };
  const chooseAlly = (hero: Hero) => {
    if (!myRole) return;
    const next = toggleAlly(allyIds, hero, heroes, myRole);
    setAllyIds(next);
    setActiveInput(next.length === 4 ? null : 'ally');
  };
  const toggleInput = (input: Exclude<ActiveInput, null>) => setActiveInput(previous => previous === input ? null : input);
  const finishMap = () => setActiveInput(complete ? null : 'enemy');
  const chooseRole = (role: Role) => {
    setMyRole(role);
    setEditingMostRole(null);
    setAllyIds(previous => reconcileAllies(previous, heroes, role));
    setActiveInput(selectedMapId ? (complete ? null : 'enemy') : 'map');
  };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">OW</span><span>COACH</span><span className="brand-divider" /><span className="page-name">{editingMostRole ? `${roleNames[editingMostRole]} 모스트 선택` : myRole ? `${roleNames[myRole]} 추천` : '역할군 선택'}</span></div>
      <span className="version-label">v1.5.1</span>
    </header>
    <WeightSettings weights={weights} storageAvailable={weightStorageAvailable} onChange={setWeights} />

    {myRole === null ? <main className="role-selection" aria-labelledby="role-selection-title">
      <span className="eyebrow">YOUR ROLE</span>
      <h1 id="role-selection-title">내 역할군을 선택하세요</h1>
      <p>플레이할 역할군을 고른 뒤 전장과 상대·아군 조합을 선택하세요.</p>
      <div className="role-options">
        {roles.map(role => <button key={role} type="button" className={`role-option ${role}`}
          aria-label={`${roleNames[role]} 선택`} onClick={() => chooseRole(role)}>
          <RoleIcon role={role} /><span>{roleNames[role]}</span>
          <span className="role-option-count">{heroes.filter(hero => hero.role === role).length}명</span>
        </button>)}
      </div>
    </main> : <>
    <div className={`current-role ${myRole}`}>
      <span><RoleIcon role={myRole} />내 역할 · <strong>{roleNames[myRole]}</strong></span>
      <button className="reset-button" type="button" data-testid="change-role" onClick={() => { setMyRole(null); setEditingMostRole(null); }}>역할 바꾸기</button>
    </div>
    {editingMostRole !== null ? <>
    <div className="most-role-tabs" role="group" aria-label="선호 영웅을 설정할 역할">
      {roles.map(role => <button key={role} className="reset-button" type="button" data-most-role={role}
        aria-pressed={editingMostRole === role} onClick={() => setEditingMostRole(role)}>{roleNames[role]}</button>)}
    </div>
    <MostPicker key={editingMostRole} heroes={heroes.filter(hero => hero.role === editingMostRole)} roleName={roleNames[editingMostRole]}
      storageAvailable={storageAvailable}
      selection={mostByRole[editingMostRole]} onChange={next => setMostByRole(previous => ({ ...previous, [editingMostRole]: next }))}
      onComplete={() => setEditingMostRole(null)} />
    </> : <>
    <MostSummary heroes={heroes} selection={mostByRole[myRole]} onEdit={() => setEditingMostRole(myRole)} />
    <main className="workspace">
      <section className="selection-panel" aria-label="전장과 상대·아군 조합 선택">
        <MapPicker maps={mapData} selectedId={selectedMapId} expanded={activeInput === 'map'}
          onToggle={() => toggleInput('map')} onContinue={finishMap}
          onChange={id => { setSelectedMapId(id); finishMap(); }} />
        <TeamPicker team="enemy" heroes={heroes} selected={selected} myRole={myRole} expanded={activeInput === 'enemy'}
          onToggle={() => toggleInput('enemy')} onChoose={chooseEnemy} onDone={() => setActiveInput(null)}
          onClear={() => { setSelected([]); setActiveInput('enemy'); }} />
        <TeamPicker team="ally" heroes={heroes} selected={allyIds} myRole={myRole} expanded={activeInput === 'ally'}
          onToggle={() => toggleInput('ally')} onChoose={chooseAlly} onDone={() => setActiveInput(null)}
          onClear={() => { setAllyIds([]); setActiveInput('ally'); }} />
      </section>

      <aside className={`recommendation-panel ${complete ? 'ready' : ''}`} aria-labelledby="recommendation-title">
        <div className="recommendation-heading"><span className="eyebrow">YOUR NEXT PICK</span><h2 id="recommendation-title">추천 {roleNames[myRole]}</h2><p>{selectedMap ? '상성과 전장을 반영한 총점순' : '상대 조합에 대한 상성 점수순'}</p></div>
        <div className="results" aria-live="polite" aria-atomic="true" data-testid="results">
          {complete ? <>
            <div className="results-caption"><span>TOP {results.length}</span><span>등급 · 총점</span></div>
            {results.map((result, index) => <RecommendationCard key={result.hero.id} result={result}
              mostRank={result.mostRank} isPossible={result.isPossible} first={index === 0} />)}
            {alternative && <section className="possible-recommendation" aria-label="전체 영웅 추가 추천">
              <div className="results-caption"><span>새로운 영웅 제안</span></div>
              <p className="most-help">선호 영웅 추천이 모두 ‘약간 불리’ 이하라 전체 영웅 중에서 제안합니다.</p>
              <RecommendationCard result={alternative} alternative />
            </section>}
            <p className="tie-note">동점은 같은 순위로 표시합니다. 등급은 역할별 고정 기준입니다.</p>
          </> : <div className="empty-results">
            <svg className="crosshair" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="19" stroke="currentColor" strokeWidth="1.5"/><path d="M32 4v14m0 28v14M4 32h14m28 0h14" stroke="currentColor" strokeWidth="2"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>
            <h3>상대 조합을 완성하세요</h3><p>{5 - selected.length}명을 더 선택하면<br />추천 {roleNames[myRole]}가 표시됩니다.</p>
            <div className="selection-progress" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < selected.length ? 'on' : ''} />)}</div>
          </div>}
        </div>
        <div className="recommendation-footer"><span className="footer-line" /><p>미입력 상성은 0점으로 계산</p><p className="data-note">추천 후보 {roleNames[myRole]} {candidateCount}명 · 상대 탱커 상성 {weights.enemy[myRole].tank}배 반영</p>
          <p className="data-note">{selectedMap ? `전장 · ${selectedMap.name_ko}` : '전장 미선택 · 맵 점수 0'}</p></div>
      </aside>
    </main>
    </>}
    </>}
    <footer className="site-footer"><span>OW COACH</span><span>비공식 팬 도구 · 영웅 이미지 © Blizzard Entertainment</span></footer>
  </div>;
}
