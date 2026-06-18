import { createPortal } from 'react-dom'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { deleteGpsMark } from '../../../lib/gpsMarksApi'
import { gpsMarkAgeDays, isGpsMarkFresh } from '../../../lib/gpsMarkFreshness'
import type { GpsMark } from '../../../types/gpsMark'
import './GpsMarkActionModal.css'

export function GpsMarkActionModal({ mark }: { mark: GpsMark }) {
  const setOpenGpsMarkId = useMapStore(s => s.setOpenGpsMarkId)
  const setAddPlaceMode = useMapStore(s => s.setAddPlaceMode)
  const setPublishingDraft = useMapStore(s => s.setPublishingDraft)
  const userId = usePlayerStore(s => s.userId)

  const ageDays = gpsMarkAgeDays(mark.createdAt)
  const fresh = isGpsMarkFresh(mark.createdAt)

  function close() { setOpenGpsMarkId(null) }

  function complete() {
    setPublishingDraft(mark)
    setAddPlaceMode(true) // ouvre AddPlaceFlow (Task 12 gère le pré-remplissage)
    close()
  }

  async function remove() {
    if (!userId) return
    const ok = await deleteGpsMark(userId, mark.id)
    if (ok) useGpsMarksStore.getState().removeLocal(mark.id)
    close()
  }

  return createPortal(
    <div className="gps-action-overlay" onClick={close}>
      <div className="gps-action-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="gps-action-title">{mark.title || 'Marque GPS'}</h3>
        <p className="gps-action-meta">
          Posée il y a {ageDays === 0 ? "aujourd'hui" : `${ageDays} j`}.
          {fresh
            ? ' Bonus visite GPS encore disponible.'
            : ' Bonus visite GPS expiré — publication possible en ajout à distance.'}
        </p>
        {mark.images.length > 0 && (
          <div className="gps-action-photos">
            {mark.images.map(img => <img key={img.id} src={img.thumb} alt="" />)}
          </div>
        )}
        <button className="gps-action-complete" onClick={complete}>✍️ Compléter la fiche</button>
        <button className="gps-action-delete" onClick={remove}>🗑️ Supprimer la marque</button>
        <button className="gps-action-cancel" onClick={close}>Fermer</button>
      </div>
    </div>,
    document.body,
  )
}
