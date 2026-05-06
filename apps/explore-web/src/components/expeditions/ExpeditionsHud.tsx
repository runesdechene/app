import { useState, useEffect } from 'react'
import { QuestsBoardPanel } from '../quests/QuestsBoardPanel'
import { ExpeditionCreator } from './ExpeditionCreator'
import { ExpeditionModal } from './ExpeditionModal'
import { useExpeditionsStore } from '../../stores/expeditionsStore'

/**
 * Orchestrateur du sous-système Expéditions côté HUD.
 * Le QuestsBoardPanel est toujours monté (cf. spec §12.4 — desktop : panel
 * sous les toasts ; mobile : page entière via mobileNav).
 *
 * Cet orchestrateur gère les états transitoires : ouverture de la modale
 * détail et du créateur. Le panel principal reste accessible en arrière-plan.
 *
 * V1 : pas de vue "Archives" — on l'ajoutera quand il y aura des archives
 * à montrer. Les RPCs `list_voyages_archives` restent en place côté backend.
 */
export function ExpeditionsHud() {
  const [creatorOpen, setCreatorOpen] = useState(false)
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
    </>
  )
}
