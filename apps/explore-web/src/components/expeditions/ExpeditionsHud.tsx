import { useState, useEffect } from 'react'
import { QuestsBoardPanel } from '../quests/QuestsBoardPanel'
import { ExpeditionCreator } from './ExpeditionCreator'
import { ExpeditionModal } from './ExpeditionModal'
import { ExpeditionCard } from './ExpeditionCard'
import { listArchivedExpeditions } from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'

/**
 * Orchestrateur du sous-système Expéditions côté HUD.
 * Le QuestsBoardPanel est toujours monté (cf. spec §12.4 — desktop : panel
 * sous les toasts ; mobile : page entière via mobileNav).
 *
 * Cet orchestrateur gère les états transitoires : ouverture de la modale
 * détail, du créateur, et des archives. Le panel principal reste accessible
 * en arrière-plan.
 */
export function ExpeditionsHud() {
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [archivesOpen, setArchivesOpen] = useState(false)
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null)

  // Demande d'ouverture déclenchée depuis ailleurs (ex : tap bannière sur la carte)
  const pendingOpen = useExpeditionsStore((s) => s.pendingOpenExpeditionId)
  const requestOpen = useExpeditionsStore((s) => s.requestOpenExpedition)
  useEffect(() => {
    if (pendingOpen) {
      setSelectedExpeditionId(pendingOpen)
      requestOpen(null)
    }
  }, [pendingOpen, requestOpen])

  // Demande d'ouverture du créateur (depuis le FAB menu)
  const pendingCreator = useExpeditionsStore((s) => s.pendingOpenCreator)
  const requestCreator = useExpeditionsStore((s) => s.requestOpenCreator)
  useEffect(() => {
    if (pendingCreator) {
      setCreatorOpen(true)
      requestCreator(false)
    }
  }, [pendingCreator, requestCreator])

  return (
    <>
      <QuestsBoardPanel
        onOpenExpedition={(id) => setSelectedExpeditionId(id)}
        onOpenCreator={() => setCreatorOpen(true)}
        onOpenArchives={() => setArchivesOpen(true)}
      />

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
    <div className="qbp-archives-overlay" onClick={onClose}>
      <div className="qbp-archives" onClick={(e) => e.stopPropagation()}>
        <header className="qbp-header">
          <div className="qbp-titlewrap">
            <div className="qbp-eyebrow">Archives</div>
            <h2 className="qbp-title">Expéditions passées</h2>
          </div>
          <button className="qbp-close" onClick={onClose} aria-label="Fermer">×</button>
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
