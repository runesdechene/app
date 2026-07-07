import type { ModListRow } from './types'
import { relativeTime } from '../../lib/relativeTime'

interface Props {
  row: ModListRow
  open: boolean
  onToggle: () => void
  onOpenLightbox: (images: string[], index: number) => void
}

export function PlaceRow({ row, open, onToggle, onOpenLightbox }: Props) {
  const suspicious = row.tags.length === 0 || (row.visit_count === 0 && row.photo_count === 0)
  return (
    <div className={`mod-row-main${open ? ' open' : ''}`} onClick={onToggle}>
      <div className={`mod-thumb${row.thumb_url ? ' clickable' : ''}`}
           onClick={row.thumb_url ? (e => { e.stopPropagation(); onOpenLightbox([row.thumb_url as string], 0) }) : undefined}>
        {row.thumb_url
          ? <img src={row.thumb_url} alt="" loading="lazy" />
          : <span>🗺️</span>}
      </div>
      <div className="mod-row-body">
        <h4>{row.title || <em>(sans titre)</em>}</h4>
        <div className="mod-badges">
          {row.tags.length === 0 && <span className="mod-flag warn">aucun tag</span>}
          {row.tags.map(t => (
            <span key={t.id} className={`mod-badge${t.is_primary ? ' primary' : ''}`}
                  style={{ background: t.background, color: t.color }}>
              {t.title}{t.is_primary ? ' ★' : ''}
            </span>
          ))}
        </div>
        <div className="mod-meta">
          <span>👤 <b>{row.author_name ?? '?'}</b></span>
          <span>🕒 <b>{relativeTime(row.created_at)}</b></span>
          {row.address && <span>📍 {row.address}</span>}
          <span>👁️ <b>{row.visit_count}</b></span>
          <span>📷 <b>{row.photo_count}</b></span>
          {row.masked && <span className="mod-flag">masqué</span>}
          {suspicious && row.tags.length > 0 && <span className="mod-flag warn">peu d'activité</span>}
        </div>
      </div>
      <div className="mod-row-state">
        {row.verified_at
          ? <><div className="mod-vstate ok">✓ Vérifié</div>
              <div className="mod-vsub">{row.verified_by_name ?? ''}</div></>
          : <><div className="mod-vstate no">● À traiter</div></>}
      </div>
    </div>
  )
}
