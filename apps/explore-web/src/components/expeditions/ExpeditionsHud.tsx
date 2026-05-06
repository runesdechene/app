import { useState, useEffect } from 'react'
import { QuestsBoardPanel } from '../quests/QuestsBoardPanel'
import { ExpeditionCreator } from './ExpeditionCreator'
import { ExpeditionModal } from './ExpeditionModal'
import { ExpeditionCard } from './ExpeditionCard'
import { listArchivedExpeditions } from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'

/**
 * Orchestrateur du sous-système Expéditions côté HUD.
 * Gère l'état des modales/panneaux : Tableau de Quêtes, création,
 * détail, archives. À monter dans MapPage. Le bouton 📋 d'ouverture
 * est rendu séparément (cf. toolbar de MapPage).
 */

interface Props {
  open: boolean
  onClose: () => void
}

export function ExpeditionsHud({ open, onClose }: Props) {
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [archivesOpen, setArchivesOpen] = useState(false)
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null)

  // Ecoute requestOpenExpedition (déclenché par tap bannière sur la carte)
  const pendingOpen = useExpeditionsStore((s) => s.pendingOpenExpeditionId)
  const requestOpen = useExpeditionsStore((s) => s.requestOpenExpedition)
  useEffect(() => {
    if (pendingOpen) {
      setSelectedExpeditionId(pendingOpen)
      requestOpen(null) // consume
    }
  }, [pendingOpen, requestOpen])

  return (
    <>
      {open && !creatorOpen && !archivesOpen && selectedExpeditionId === null && (
        <QuestsBoardPanel
          onClose={onClose}
          onOpenExpedition={(id) => setSelectedExpeditionId(id)}
          onOpenCreator={() => setCreatorOpen(true)}
          onOpenArchives={() => setArchivesOpen(true)}
        />
      )}

      {creatorOpen && (
        <ExpeditionCreator
          onClose={() => setCreatorOpen(false)}
          onCreated={(id) => {
            setCreatorOpen(false)
            setSelectedExpeditionId(id)
          }}
        />
      )}

      {selectedExpeditionId && (
        <ExpeditionModal
          expeditionId={selectedExpeditionId}
          onClose={() => setSelectedExpeditionId(null)}
        />
      )}

      {archivesOpen && (
        <ArchivesPanel
          onClose={() => setArchivesOpen(false)}
          onOpenExpedition={(id) => setSelectedExpeditionId(id)}
        />
      )}
    </>
  )
}

// ─────────── ArchivesPanel ───────────
// Vue dédiée aux expéditions archivées (consultables par tous, coque publique).

interface ArchivesProps {
  onClose: () => void
  onOpenExpedition: (id: string) => void
}

function ArchivesPanel({ onClose, onOpenExpedition }: ArchivesProps) {
  const archives = useExpeditionsStore((s) => s.archives)
  const setArchives = useExpeditionsStore((s) => s.setArchives)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listArchivedExpeditions(50, 0)
      .then((list) => { if (!cancelled) setArchives(list) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [setArchives])

  return (
    <div className="qbp-overlay qbp-mounted" onClick={onClose}>
      <div className="qbp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="qbp-handle" />
        <header className="qbp-header">
          <div>
            <div className="qbp-eyebrow">Archives</div>
            <h2 className="qbp-title">Expéditions passées</h2>
          </div>
          <button className="qbp-cta-mini" onClick={onClose}>Fermer</button>
        </header>
        {loading ? (
          <div className="expeditions-list-loading">Chargement…</div>
        ) : archives.length === 0 ? (
          <div className="expeditions-list-empty">Pas encore d'archives.</div>
        ) : (
          <ul className="expeditions-list">
            {archives.map((e) => (
              <ExpeditionCard
                key={e.id}
                item={e}
                onClick={() => onOpenExpedition(e.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
