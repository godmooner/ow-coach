import { useState } from 'react';
import type { Hero, Role } from './recommend';

export function RoleIcon({ role }: { role: Role }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {role === 'tank' ? <path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" stroke="currentColor" strokeWidth="1.8" /> :
     role === 'damage' ? <><path d="M5 20V8l2-4 2 4v12M10 20V8l2-4 2 4v12M15 20V8l2-4 2 4v12" stroke="currentColor" strokeWidth="1.8" /></> :
     <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" fill="currentColor" />}
  </svg>;
}

export function Portrait({ hero }: { hero: Hero }) {
  const [failed, setFailed] = useState(false);
  const portable = (window as Window & { __OW_PORTRAITS__?: Record<string, string> }).__OW_PORTRAITS__;
  if (failed) return <span className="portrait-fallback" aria-hidden="true">{hero.name_ko.slice(0, 2)}</span>;
  return <img className="portrait" src={portable?.[hero.id] ?? `${import.meta.env.BASE_URL}${hero.portrait}`}
    alt="" draggable={false} onError={() => setFailed(true)} />;
}
