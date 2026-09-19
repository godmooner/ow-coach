import { useState } from 'react';
import heroData from '../data/build/heroes.json';
import matchupData from '../data/build/matchups.json';
import { ROLE_LIMITS, recommend, formatScore, toggleHero } from './recommend';
import type { Hero, Role, Matchups } from './recommend';

const heroes = heroData as Hero[];
const matchups: Matchups = matchupData;
const roles: Role[] = ['tank', 'damage', 'support'];
const roleNames: Record<Role, string> = { tank: '탱커', damage: '딜러', support: '힐러' };

function RoleIcon({ role }: { role: Role }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {role === 'tank' ? <path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.8" /> :
     role === 'damage' ? <><path d="M5 20V8l2-4 2 4v12M10 20V8l2-4 2 4v12M15 20V8l2-4 2 4v12" stroke="currentColor" strokeWidth="1.8" /></> :
     <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" fill="currentColor" />}
  </svg>;
}

function Portrait({ hero }: { hero: Hero }) {
  const [failed, setFailed] = useState(false);
  const portable = (window as Window & { __OW_PORTRAITS__?: Record<string, string> }).__OW_PORTRAITS__;
  if (failed) return <span className="portrait-fallback" aria-hidden="true">{hero.name_ko.slice(0, 2)}</span>;
  return <img className="portrait" src={portable?.[hero.id] ?? `${import.meta.env.BASE_URL}${hero.portrait}`}
    alt="" draggable={false} onError={() => setFailed(true)} />;
}

export default function App() {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedHeroes = selected.map(id => heroes.find(hero => hero.id === id)!);
  const results = recommend(heroes, matchups, selected).slice(0, 3);
  const complete = selected.length === 5;
  const counts = Object.fromEntries(roles.map(role => [role, selectedHeroes.filter(hero => hero.role === role).length])) as Record<Role, number>;
  const choose = (hero: Hero) => setSelected(previous => toggleHero(previous, hero, heroes));

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">OW</span><span>COACH</span><span className="brand-divider" /><span className="page-name">딜러 추천</span></div>
      <span className="version-label">MVP 0.3</span>
    </header>

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
      </section>

      <aside className={`recommendation-panel ${complete ? 'ready' : ''}`} aria-labelledby="recommendation-title">
        <div className="recommendation-heading"><span className="eyebrow">YOUR NEXT PICK</span><h2 id="recommendation-title">추천 딜러</h2><p>상대 조합에 대한 상성 점수순</p></div>
        <div className="results" aria-live="polite" aria-atomic="true" data-testid="results">
          {complete ? <>
            <div className="results-caption"><span>TOP 3</span><span>총점</span></div>
            {results.map((result, index) => <article key={result.hero.id} className={`result-card ${index === 0 ? 'first' : ''}`}
              data-result-id={result.hero.id} data-score={result.score}>
              <div className="result-portrait"><Portrait hero={result.hero} /><span className="rank">{String(result.rank).padStart(2, '0')}</span></div>
              <div className="result-name"><span>{index === 0 ? '추천 픽' : '다른 선택'}</span><h3>{result.hero.name_ko}</h3></div>
              <div className={`score ${result.score < 0 ? 'negative' : result.score === 0 ? 'neutral' : ''}`}>{formatScore(result.score)}<span>점</span></div>
            </article>)}
            <p className="tie-note">동점은 같은 순위로 표시합니다.</p>
          </> : <div className="empty-results">
            <svg className="crosshair" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="19" stroke="currentColor" strokeWidth="1.5"/><path d="M32 4v14m0 28v14M4 32h14m28 0h14" stroke="currentColor" strokeWidth="2"/><circle cx="32" cy="32" r="3" fill="currentColor"/></svg>
            <h3>상대 조합을 완성하세요</h3><p>{5 - selected.length}명을 더 선택하면<br />추천 딜러가 표시됩니다.</p>
            <div className="selection-progress" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < selected.length ? 'on' : ''} />)}</div>
          </div>}
        </div>
        <div className="recommendation-footer"><span className="footer-line" /><p>미입력 상성은 0점으로 계산</p><p className="data-note">딜러 {heroes.filter(hero => hero.role === 'damage').length}명 · 가중치 없는 단순 합산</p></div>
      </aside>
    </main>
    <footer className="site-footer"><span>OW COACH</span><span>비공식 팬 도구 · 영웅 이미지 © Blizzard Entertainment</span></footer>
  </div>;
}
