import { useState } from 'react'
import './NouvelleExploreModal.css'
import { usePlayerStore } from '../../stores/playerStore'
import { goToV2, retenirVersion, versionChoisie } from '../../lib/v2Access'

// « La nouvelle Explore est là » : proposée une fois aux joueurs connectés. Essayer → la V2, et
// la V1 y renverra ensuite d'elle-même ; Plus tard → on repose la question dans 30 jours.
export function NouvelleExploreModal() {
  const userId = usePlayerStore(s => s.userId)
  const [ouverte, setOuverte] = useState(() => versionChoisie() === null)

  if (!userId || !ouverte) return null

  function plusTard() {
    retenirVersion('v1', 30)
    setOuverte(false)
  }

  return (
    <div className="nouvelle-explore-overlay" onClick={plusTard}>
      <div
        className="nouvelle-explore"
        role="dialog"
        aria-labelledby="nouvelle-explore-titre"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="nouvelle-explore-titre" className="nouvelle-explore__titre">
          La nouvelle Explore est là
        </h2>
        <p className="nouvelle-explore__texte">
          Une application repensée de fond en comble : une carte plus belle, découvrir sans
          énergie, le Carnet de passage, les Messages… Tes lieux, tes visites et ton niveau t'y
          suivent.
        </p>
        <p className="nouvelle-explore__texte nouvelle-explore__texte--discret">
          Tu pourras revenir à cette version à tout moment, depuis les Préférences.
        </p>
        <button className="nouvelle-explore__essayer" onClick={goToV2}>
          Essayer la nouvelle Explore
        </button>
        <button className="nouvelle-explore__plus-tard" onClick={plusTard}>
          Plus tard
        </button>
      </div>
    </div>
  )
}
