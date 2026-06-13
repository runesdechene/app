import etendardIcon from '../../../assets/etendard.png'
import './OnSiteActionModal.css'

interface Props {
  placeTitle: string
  /** Le joueur veille déjà ce lieu en GPS → on propose « Réaffirmer » au lieu de « Planter ». */
  isAlreadyVeilleurGps: boolean
  /** Le joueur a déjà visité ce lieu → l'option « Marquer ma visite » est désactivée. */
  alreadyVisited: boolean
  /** Au moins un autre joueur connecté est à proximité (active « avec compagnons »). */
  hasCompanionsNearby: boolean
  onPlantSolo: () => void
  onPlantCompanions: () => void
  onVisit: () => void
  onClose: () => void
}

export function OnSiteActionModal({
  placeTitle, isAlreadyVeilleurGps, alreadyVisited, hasCompanionsNearby,
  onPlantSolo, onPlantCompanions, onVisit, onClose,
}: Props) {
  return (
    <div className="onsite-action-overlay" onClick={onClose}>
      <div className="onsite-action-modal" onClick={e => e.stopPropagation()}>
        <button className="onsite-action-close" onClick={onClose} aria-label="Fermer">&#10005;</button>
        <h3 className="onsite-action-title">{placeTitle}</h3>
        <p className="onsite-action-subtitle">Tu es sur place. Que fais-tu ?</p>

        <div className="onsite-action-choices">
          {isAlreadyVeilleurGps ? (
            <button className="onsite-action-choice" onClick={onPlantSolo}>
              <img src={etendardIcon} alt="" className="onsite-action-choice-icon" />
              <span className="onsite-action-choice-label">Réaffirmer mon étendard</span>
              <span className="onsite-action-choice-hint">Tu veilles déjà ce lieu — efface les menaces de la Cour</span>
            </button>
          ) : (
            <>
              <button className="onsite-action-choice" onClick={onPlantSolo}>
                <img src={etendardIcon} alt="" className="onsite-action-choice-icon" />
                <span className="onsite-action-choice-label">Planter mon étendard</span>
                <span className="onsite-action-choice-hint">Seul — tu deviens veilleur de ce lieu</span>
              </button>
              <button
                className="onsite-action-choice"
                onClick={onPlantCompanions}
                disabled={!hasCompanionsNearby}
                title={hasCompanionsNearby ? undefined : 'Personne d\'autre n\'est connecté à proximité'}
              >
                <span className="onsite-action-choice-emoji">{'\u{1F465}'}</span>
                <span className="onsite-action-choice-label">Planter avec des compagnons</span>
                <span className="onsite-action-choice-hint">
                  {hasCompanionsNearby
                    ? 'Lance une expédition commune avec les joueurs proches'
                    : 'Personne à proximité pour l\'instant'}
                </span>
              </button>
            </>
          )}

          <button
            className="onsite-action-choice"
            onClick={onVisit}
            disabled={alreadyVisited}
            title={alreadyVisited ? 'Tu as déjà visité ce lieu' : undefined}
          >
            <span className="onsite-action-choice-emoji">{'\u{1F4CD}'}</span>
            <span className="onsite-action-choice-label">Marquer ma visite</span>
            <span className="onsite-action-choice-hint">
              {alreadyVisited ? 'Déjà visité' : 'Je suis venu, sans planter — par respect pour le veilleur'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
