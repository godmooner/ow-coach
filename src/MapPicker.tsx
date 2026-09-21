import { useState } from 'react';

export type BattleMap = { id: string; name_ko: string; mode: string };

function MapImage({ map }: { map: BattleMap }) {
  const [failed, setFailed] = useState(false);
  const portable = (window as Window & { __OW_MAPS__?: Record<string, string> }).__OW_MAPS__;
  return failed ? null : <img src={portable?.[map.id] ?? `${import.meta.env.BASE_URL}maps/${map.id}.webp`}
    alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} />;
}

function MapCard({ map, selected, onSelect }: { map: BattleMap; selected: boolean; onSelect: () => void }) {
  return <button type="button" className={`map-card ${selected ? 'selected' : ''}`}
    data-map-id={map.id} aria-label={map.name_ko} aria-pressed={selected} onClick={onSelect}>
    <span className="map-art">
      <MapImage map={map} />
      {selected && <span className="map-tick" aria-hidden="true">✓</span>}
    </span>
    <span className="map-name">{map.name_ko}</span>
  </button>;
}

export function MapPicker({ maps, selectedId, expanded, onChange, onToggle, onContinue }: {
  maps: BattleMap[];
  selectedId: string | null;
  expanded: boolean;
  onChange: (id: string | null) => void;
  onToggle: () => void;
  onContinue: () => void;
}) {
  const selected = maps.find(map => map.id === selectedId);
  const [mode, setMode] = useState<string | null>(() => selected?.mode ?? null);
  const modes = [...new Set(maps.map(map => map.mode))];
  return <section className={`selection-step map-selection ${expanded ? 'expanded' : ''}`} data-step="map" aria-labelledby="map-selection-title">
    <div className="map-heading">
      <div><span className="eyebrow">01 · BATTLEFIELD</span><h2 id="map-selection-title">전장</h2></div>
      <button type="button" className="reset-button" data-testid="map-edit" id="map-edit" aria-expanded={expanded} aria-controls="map-picker" onClick={onToggle}>
        {expanded ? '접기' : selected ? '전장 변경' : '전장 선택'}
      </button>
    </div>
    <div className="current-map" data-testid="current-map" aria-live="polite">
      {selected ? <><span className="selected-map-image"><MapImage key={selected.id} map={selected} /></span><strong>{selected.name_ko}</strong><span>{selected.mode}</span></> : '선택 안 함 · 전장 없이도 추천받을 수 있습니다.'}
    </div>
    {expanded && <div id="map-picker" className="map-picker">
      <div className="map-modes" role="group" aria-label="전장 모드 선택">
        {modes.map(item => <button key={item} type="button" data-mode={item} aria-pressed={mode === item}
          className={`map-mode ${mode === item ? 'active' : ''}`} onClick={() => setMode(item)}>
          {item}<span>{maps.filter(map => map.mode === item).length}</span>
        </button>)}
      </div>
      {mode ? <div className="map-grid" aria-label={`${mode} 전장`}>
        {maps.filter(map => map.mode === mode).map(map => <MapCard key={map.id} map={map} selected={selectedId === map.id} onSelect={() => onChange(map.id)} />)}
      </div> : <p className="map-hint">모드를 고른 뒤 전장을 선택하세요. 전장을 고르지 않아도 추천됩니다.</p>}
      <div className="map-picker-actions">
        {selected && <button type="button" className="text-button" data-testid="map-clear" onClick={() => onChange(null)}>전장 해제</button>}
        <button type="button" className="reset-button" data-testid="map-skip" onClick={onContinue}>{selected ? '완료 · 접기' : '전장 없이 진행'}</button>
      </div>
    </div>}
  </section>;
}
