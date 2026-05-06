import { useState } from 'react'
import { getExpeditionMediaUrl } from '../../lib/expeditionsApi'
import type { ExpeditionReport } from '../../types/expedition'

interface Props {
  reports: ExpeditionReport[]
}

/**
 * Galerie agrégée des médias de tous les comptes rendus de l'expédition.
 * Grille mosaïque, tap → fullscreen viewer simple.
 */
export function ExpeditionGallery({ reports }: Props) {
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null)

  const allMedias = reports.flatMap((r) => (r.medias ?? []).map((m) => ({
    ...m, author: r.display_name, isPublic: r.is_public,
  })))

  if (allMedias.length === 0) return null

  const visible = allMedias.slice(0, 12)
  const more = allMedias.length - visible.length

  return (
    <>
      <div className="expedition-gallery">
        {visible.map((m, i) => (
          <button
            key={m.id}
            className={`expedition-gallery-tile is-${m.kind}`}
            onClick={() => setFullscreenIdx(i)}
            aria-label={`${m.kind === 'photo' ? 'Photo' : 'Vidéo'} de ${m.author}`}
            style={{ backgroundImage: `url(${getExpeditionMediaUrl(m.storage_path)})` }}
          >
            {m.kind === 'video' && <span className="expedition-gallery-play">▶</span>}
          </button>
        ))}
        {more > 0 && (
          <div className="expedition-gallery-more">+{more}</div>
        )}
      </div>

      {fullscreenIdx !== null && allMedias[fullscreenIdx] && (
        <div className="expedition-gallery-fullscreen" onClick={() => setFullscreenIdx(null)}>
          <button className="expedition-gallery-fullscreen-close" onClick={() => setFullscreenIdx(null)}>×</button>
          {allMedias[fullscreenIdx].kind === 'photo' ? (
            <img src={getExpeditionMediaUrl(allMedias[fullscreenIdx].storage_path)} alt="" />
          ) : (
            <video src={getExpeditionMediaUrl(allMedias[fullscreenIdx].storage_path)} controls autoPlay />
          )}
          <div className="expedition-gallery-fullscreen-author">
            {allMedias[fullscreenIdx].author}
          </div>
        </div>
      )}
    </>
  )
}
