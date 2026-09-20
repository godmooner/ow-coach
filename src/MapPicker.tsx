import { useState } from 'react';

export type BattleMap = { id: string; name_ko: string; mode: string };

function MapCard({ map, selected, onSelect }: { map: BattleMap; selected: boolean; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  const portable = (window as Window & { __OW_MAPS__?: Record<string, string> }).__OW_MAPS__;
  return <button type="button" className={`map-card ${selected ? 'selected' : ''} ${failed ? 'image-missing' : ''}`}
    data-map-id={map.id} aria-label={map.name_ko} aria-pressed={selected} onClick={onSelect}>
    <span className="map-art">
      {!failed && <img src={portable?.[map.id] ?? `${import.meta.env.BASE_URL}maps/${map.id}.webp`}
        alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} />}
      {selected && <span className="map-tick" aria-hidden="true">✓</span>}
    </span>
    <span className="map-name">{map.name_ko}</span>
  </button>;
}

export function MapPicker({ maps, selectedId, enabled, onChange }: {
  maps: BattleMap[];
  selectedId: string | null;
  enabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const selected = maps.find(map => map.id === selectedId);
  const [mode, setMode] = useState<string | null>(() => selected?.mode ?? null);
  const modes = [...new Set(maps.map(map => map.mode))];
  return <section className="map-selection" aria-labelledby="map-selection-title">
    <div className="map-heading">
      <div><span className="eyebrow">BATTLEFIELD · OPTIONAL</span><h2 id="map-selection-title">전장 선택</h2></div>
      <button type="button" className="reset-button" data-testid="map-clear" disabled={!selected} onClick={() => onChange(null)}>전장 해제</button>
    </div>
    <p className="current-map" data-testid="current-map" aria-live="polite">
      {selected ? <>선택한 전장 · <strong>{selected.name_ko}</strong><span>{selected.mode}</span></> : '선택 안 함 · 맵 점수 0'}
    </p>
    {enabled ? <>
      <div className="map-modes" role="group" aria-label="전장 모드 선택">
        {modes.map(item => <button key={item} type="button" data-mode={item} aria-pressed={mode === item}
          className={`map-mode ${mode === item ? 'active' : ''}`} onClick={() => setMode(item)}>
          {item}<span>{maps.filter(map => map.mode === item).length}</span>
        </button>)}
      </div>
      {mode ? <div className="map-grid" aria-label={`${mode} 전장`}>
        {maps.filter(map => map.mode === mode).map(map => <MapCard key={map.id} map={map} selected={selectedId === map.id} onSelect={() => onChange(map.id)} />)}
      </div> : <p className="map-hint">모드를 고른 뒤 전장을 선택하세요. 전장을 고르지 않아도 추천됩니다.</p>}
    </> : <p className="map-hint">상대 5명을 고르면 전장을 선택할 수 있습니다. 상대 초기화 후에도 선택한 전장은 유지됩니다.</p>}
  </section>;
}
