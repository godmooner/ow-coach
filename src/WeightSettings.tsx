import { defaultWeights, weightsAreDefault } from './weights';
import type { Role, ScoringWeights } from './recommend';

const roles: { id: Role; name: string }[] = [{ id: 'tank', name: '탱커' }, { id: 'damage', name: '딜러' }, { id: 'support', name: '힐러' }];

function WeightSlider({ id, label, value, max, step, disabled = false, onChange }: {
  id: string; label: string; value: number; max: number; step: number; disabled?: boolean; onChange?: (value: number) => void;
}) {
  return <div className={`weight-control ${disabled ? 'disabled' : ''}`}>
    <label htmlFor={id}><span>{label}</span><output htmlFor={id}>{value.toFixed(step === 0.05 ? 2 : 1)}배</output></label>
    <input id={id} type="range" min="0" max={max} step={step} value={value} disabled={disabled}
      onChange={event => onChange?.(event.currentTarget.valueAsNumber)} />
  </div>;
}

export function WeightSettings({ weights, storageAvailable, onChange }: {
  weights: ScoringWeights; storageAvailable: boolean; onChange: (weights: ScoringWeights) => void;
}) {
  const custom = !weightsAreDefault(weights);
  return <details className="weight-settings" data-testid="weight-settings">
    <summary data-testid="weights-toggle">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="m10 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-2-1-3-3-1-1-3-3 1Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="11" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
      <span>개발용 설정</span>{custom && <span className="settings-indicator">변경됨</span>}
    </summary>
    <div className="weight-settings-body">
      <div className="weight-settings-heading"><p>가중치를 조절하면 추천이 바로 갱신됩니다.</p>
        <button className="reset-button" type="button" data-testid="weights-default" disabled={!custom} onClick={() => onChange(defaultWeights())}>기본값으로</button></div>
      <div className="weight-groups">
        <fieldset><legend>점수 영역별 가중치</legend>
          <WeightSlider id="weight-matchup" label="상성" value={weights.block.matchup} max={2} step={0.05}
            onChange={value => onChange({ ...weights, block: { ...weights.block, matchup: value } })} />
          <WeightSlider id="weight-map" label="맵" value={weights.block.map} max={2} step={0.05}
            onChange={value => onChange({ ...weights, block: { ...weights.block, map: value } })} />
          <WeightSlider id="weight-synergy" label="아군 궁합 · 데이터 없음" value={weights.block.synergy} max={2} step={0.05} disabled />
        </fieldset>
        <fieldset><legend>내 역할별 상대 탱커 가중치</legend>
          {roles.map(role => <WeightSlider key={role.id} id={`weight-enemy-${role.id}`} label={`내가 ${role.name}일 때`}
            value={weights.enemy[role.id].tank} max={5} step={0.5}
            onChange={value => onChange({ ...weights, enemy: { ...weights.enemy, [role.id]: { ...weights.enemy[role.id], tank: value } } })} />)}
        </fieldset>
      </div>
      <p className="weight-note">등급은 기본 가중치로 만든 고정 기준입니다. 가중치 조정이 끝나면 등급 경계선을 다시 산출해야 합니다.</p>
      {!storageAvailable && <p className="weight-storage-notice" role="status">브라우저 저장을 사용할 수 없어 이번 페이지에서만 설정이 유지됩니다.</p>}
    </div>
  </details>;
}
