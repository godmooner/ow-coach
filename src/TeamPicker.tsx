import { ROLE_LIMITS } from './recommend';
import type { Hero, Role } from './recommend';
import { Portrait, RoleIcon } from './HeroVisuals';
import { allyRoleLimits } from './allySelection';

const roles: Role[] = ['tank', 'damage', 'support'];
const roleNames: Record<Role, string> = { tank: '탱커', damage: '딜러', support: '힐러' };
type Team = 'enemy' | 'ally';

// Both teams use this picker; App permits only one expanded input at a time.
function HeroPicker({ heroes, selected, limits, team, onChoose, onDone }: {
  heroes: Hero[]; selected: string[]; limits: Record<Role, number>; team: Team;
  onChoose: (hero: Hero) => void; onDone: () => void;
}) {
  const availableRoles = roles.filter(role => limits[role] > 0);
  return <div className="hero-picker" data-picking-team={team} id={`${team}-picker`}>
    <div className="picker-heading">
      <p><strong>{team === 'enemy' ? '상대 영웅' : '아군 영웅'}</strong>을 선택하세요. 다시 누르면 해제됩니다.</p>
      <button type="button" className="reset-button" data-testid="picker-done" onClick={onDone}>완료 · 접기</button>
    </div>
    <div className={`roster ${availableRoles.length === 2 ? 'two-roles' : ''}`}>
      {availableRoles.map(role => {
        const count = selected.filter(id => heroes.find(hero => hero.id === id)?.role === role).length;
        return <section key={role} className={`role-group ${role}`} aria-labelledby={`${team}-heading-${role}`}>
          <div className="role-heading"><h3 id={`${team}-heading-${role}`}><RoleIcon role={role} />{roleNames[role]}</h3><span>{count} / {limits[role]}</span></div>
          <div className="hero-grid">
            {heroes.filter(hero => hero.role === role).map(hero => {
              const active = selected.includes(hero.id);
              return <button key={hero.id} type="button" data-hero-id={hero.id}
                className={`hero-button ${active ? 'selected' : ''}`} aria-label={hero.name_ko} aria-pressed={active}
                disabled={!active && count >= limits[role]} onClick={() => onChoose(hero)}>
                <Portrait hero={hero} />{active && <span className="selected-tick" aria-hidden="true">✓</span>}
                <span className="hero-name">{hero.name_ko}</span>
              </button>;
            })}
          </div>
        </section>;
      })}
    </div>
    <button type="button" className="reset-button picker-bottom-done" onClick={onDone}>완료 · 접기</button>
  </div>;
}

export function TeamPicker({ team, heroes, selected, myRole, expanded, onToggle, onChoose, onClear, onDone }: {
  team: Team; heroes: Hero[]; selected: string[]; myRole: Role; expanded: boolean;
  onToggle: () => void; onChoose: (hero: Hero) => void; onClear: () => void; onDone: () => void;
}) {
  const ally = team === 'ally';
  const limits = ally ? allyRoleLimits(myRole) : ROLE_LIMITS;
  const maximum = ally ? 4 : 5;
  const title = ally ? '아군 조합' : '상대 조합';
  const selectedHeroes = selected.map(id => heroes.find(hero => hero.id === id)!);
  return <section className={`selection-step team-selection ${expanded ? 'expanded' : ''}`} data-step={team} data-team={team}
    aria-labelledby={`${team}-selection-title`}>
    <div className="section-heading">
      <div><span className="eyebrow">{ally ? '03 · ALLY TEAM' : '02 · ENEMY TEAM'}</span><h2 id={`${team}-selection-title`}>{title}</h2></div>
      <div className="selection-actions">
        <span className={`selection-count ${selected.length === maximum ? 'complete' : ''}`} aria-live="polite" aria-label={`${title} ${selected.length}명 선택`}>
          {selected.length}<span> / {maximum}</span>
        </span>
        <button type="button" className="reset-button" data-testid={`${team}-edit`} id={`${team}-edit`}
          aria-expanded={expanded} aria-controls={`${team}-picker`} onClick={onToggle}>
          {expanded ? '접기' : `${ally ? '아군' : '상대'} ${selected.length ? '변경' : '선택'}`}
        </button>
      </div>
    </div>
    <div className="team-slots">
      {roles.flatMap(role => Array.from({ length: ROLE_LIMITS[role] }, (_, index) => {
        const self = ally && role === myRole && index === 0;
        const heroIndex = ally && role === myRole ? index - 1 : index;
        const hero = self ? undefined : selectedHeroes.filter(item => item.role === role)[heroIndex];
        return <button key={`${role}-${index}`} type="button" className={`team-slot ${role} ${self ? 'self-slot' : hero ? 'filled' : ''}`}
          aria-label={self ? `내 자리 · ${roleNames[role]}` : hero ? `${title} ${hero.name_ko} 선택 해제` : `${title} ${roleNames[role]} ${index + 1} 선택`}
          disabled={self} onClick={() => { if (hero) onChoose(hero); else if (!expanded) onToggle(); }}>
          {hero ? <><Portrait key={hero.id} hero={hero} /><span className="slot-remove" aria-hidden="true">×</span></> : <RoleIcon role={role} />}
          {self && <span className="self-slot-badge">나</span>}
          <span className="slot-name">{self ? '내 자리' : hero ? hero.name_ko : roleNames[role]}</span>
        </button>;
      }))}
    </div>
    <div className="team-note">
      <p>{ally ? '내 자리를 제외한 4명 · 현재 추천 점수에는 반영되지 않습니다.' : selected.length === 5 ? '상대 선택 완료 · 필요하면 슬롯을 눌러 수정하세요.' : '탱커 1명 · 딜러 2명 · 힐러 2명'}</p>
      {selected.length > 0 && <button type="button" className="text-button" data-testid={`${team}-clear`} onClick={onClear}>초기화</button>}
    </div>
    {expanded && <HeroPicker heroes={heroes} selected={selected} limits={limits} team={team} onChoose={onChoose} onDone={onDone} />}
  </section>;
}
