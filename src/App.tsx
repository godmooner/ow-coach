import { useEffect, useState } from 'react';
import heroData from '../data/build/heroes.json';
import matchupData from '../data/build/matchups.json';
import mapData from '../data/build/maps.json';
import mapScoreData from '../data/build/map_scores.json';
import { ROLE_LIMITS, recommend, formatScore, toggleHero } from './recommend';
import type { Hero, Role, Matchups, MapScores } from './recommend';
import { Portrait, RoleIcon } from './HeroVisuals';
import { MostPicker, MostSummary } from './MostPicker';
import { emptyMostByRole, loadMost, saveMost } from './most';
import { filterRecommendations, gradeForScore } from './recommendationView';
import { MapPicker } from './MapPicker';
import { WeightSettings } from './WeightSettings';
import { defaultWeights, loadWeights, saveWeights } from './weights';

const heroes = heroData as Hero[];
const matchups: Matchups = matchupData;
const mapScores: MapScores = mapScoreData;
const roles: Role[] = ['tank', 'damage', 'support'];
const roleNames: Record<Role, string> = { tank: '탱커', damage: '딜러', support: '힐러' };

export default function App() {
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [selectingMost, setSelectingMost] = useState(true);
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
  const selectedHeroes = selected.map(id => heroes.find(hero => hero.id === id)!);
  const preferredIds = myRole ? mostByRole[myRole].ids : [];
  const candidateCount = myRole ? preferredIds.length || heroes.filter(hero => hero.role === myRole).length : 0;
  const results = myRole ? filterRecommendations(recommend(heroes, matchups, selected, myRole,
    { mapId: selectedMapId, mapScores, weights }), preferredIds).slice(0, 3) : [];
  const complete = selected.length === 5;
  const counts = Object.fromEntries(roles.map(role => [role, selectedHeroes.filter(hero => hero.role === role).length])) as Record<Role, number>;
  const choose = (hero: Hero) => setSelected(previous => toggleHero(previous, hero, heroes));

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">OW</span><span>COACH</span><span className="brand-divider" /><span className="page-name">{myRole ? `${roleNames[myRole]} ${selectingMost ? '모스트 선택' : '추천'}` : '역할군 선택'}</span></div>
      <span className="version-label">v1.0</span>
    </header>
    <WeightSettings weights={weights} storageAvailable={weightStorageAvailable} onChange={setWeights} />

    {myRole === null ? <main className="role-selection" aria-labelledby="role-selection-title">
      <span className="eyebrow">YOUR ROLE</span>
      <h1 id="role-selection-title">내 역할군을 선택하세요</h1>
      <p>플레이할 역할군을 고른 뒤 모스트를 선택하세요.</p>
      <div className="role-options">
        {roles.map(role => <button key={role} type="button" className={`role-option ${role}`}
          aria-label={`${roleNames[role]} 선택`} onClick={() => { setMyRole(role); setSelectingMost(true); }}>
          <RoleIcon role={role} /><span>{roleNames[role]}</span>
          <span className="role-option-count">{heroes.filter(hero => hero.role === role).length}명</span>
        </button>)}
      </div>
    </main> : <>
    <div className={`current-role ${myRole}`}>
      <span><RoleIcon role={myRole} />내 역할 · <strong>{roleNames[myRole]}</strong></span>
      <button className="reset-button" type="button" onClick={() => setMyRole(null)}>역할 바꾸기</button>
    </div>
    {selectingMost ? <MostPicker heroes={heroes.filter(hero => hero.role === myRole)} roleName={roleNames[myRole]}
      storageAvailable={storageAvailable}
      selection={mostByRole[myRole]} onChange={next => setMostByRole(previous => ({ ...previous, [myRole]: next }))}
      onComplete={() => setSelectingMost(false)} /> : <>
    <MostSummary heroes={heroes} selection={mostByRole[myRole]} onEdit={() => setSelectingMost(true)} />
    <main className="workspace">
      <section className="selection-panel" aria-labelledby="selection-title">
        <div className="section-heading">
          <div><span className="eyebrow">ENEMY TEAM</span><h1 id="selection-title">상대 조합</h1></div>
          <div className="selection-actions"><span className={`selection-count ${complete ? 'complete' : ''}`} aria-live="polite">{selected.length}<span> / 5</span></span>
          <button className="reset-button" onClick={() => setSelected([])} disabled={!selected.length}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7a6 6 0 1 1-.3 5M4 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>초기화
          </button></div>
        </div>

        <div className="enemy-slots">
          {roles.flatMap(role => Array.from({ length: ROLE_LIMITS[role] }, (_, index) => {
            const hero = selectedHeroes.filter(item => item.role === role)[index];
            return <button key={`${role}-${index}`} className={`enemy-slot ${role} ${hero ? 'filled' : ''}`}
              aria-label={hero ? `${hero.name_ko} 선택 해제` : `${roleNames[role]} ${index + 1} 빈 슬롯`}
              disabled={!hero} onClick={() => hero && choose(hero)}>
              {hero ? <><Portrait hero={hero} /><span className="slot-remove" aria-hidden="true">×</span></> : <RoleIcon role={role} />}
              <span className="slot-name">{hero ? hero.name_ko : roleNames[role]}</span>
            </button>;
          }))}
        </div>
        <p className="input-hint">초상화를 눌러 선택하고, 다시 눌러 해제하세요.</p>

        <div className="roster">
          {roles.map(role => <section key={role} className={`role-group ${role}`} aria-labelledby={`heading-${role}`}>
            <div className="role-heading"><h2 id={`heading-${role}`}><RoleIcon role={role} />{roleNames[role]}</h2><span>{counts[role]} / {ROLE_LIMITS[role]}</span></div>
            <div className="hero-grid">
              {heroes.filter(hero => hero.role === role).map(hero => {
                const active = selected.includes(hero.id);
                const disabled = !active && counts[role] >= ROLE_LIMITS[role];
                return <button key={hero.id} type="button" data-hero-id={hero.id}
                  className={`hero-button ${active ? 'selected' : ''}`} aria-label={hero.name_ko} aria-pressed={active}
                  disabled={disabled} onClick={() => choose(hero)}>
                  <Portrait hero={hero} />{active && <span className="selected-tick" aria-hidden="true">✓</span>}
                  <span className="hero-name">{hero.name_ko}</span>
                </button>;
              })}
            </div>
          </section>)}
        </div>
        <MapPicker maps={mapData} selectedId={selectedMapId} enabled={complete} onChange={setSelectedMapId} />
      </section>

      <aside className={`recommendation-panel ${complete ? 'ready' : ''}`} aria-labelledby="recommendation-title">
        <div className="recommendation-heading"><span className="eyebrow">YOUR NEXT PICK</span><h2 id="recommendation-title">추천 {roleNames[myRole]}</h2><p>{selectedMap ? '상성과 전장을 반영한 총점순' : '상대 조합에 대한 상성 점수순'}</p></div>
        <div className="results" aria-live="polite" aria-atomic="true" data-testid="results">
          {complete ? <>
            <div className="results-caption"><span>TOP {results.length}</span><span>등급 · 총점</span></div>
            {results.map((result, index) => {
              const grade = gradeForScore(result.score, myRole);
              return <article key={result.hero.id} className={`result-card ${index === 0 ? 'first' : ''}`}
              data-result-id={result.hero.id} data-score={result.score}>
              <div className="result-portrait"><Portrait hero={result.hero} /><span className="rank">{String(result.rank).padStart(2, '0')}</span></div>
              <div className="result-name"><span>{index === 0 ? '추천 픽' : '다른 선택'}</span><h3>{result.hero.name_ko}</h3></div>
              <div className="result-grade">
                <strong className={`grade-label grade-${grade.level}`} data-testid="grade">{grade.label}</strong>
                <span className="score">{formatScore(result.score)}<span>점</span></span>
              </div>
            </article>;
            })}
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
