import './VeteranWelcomeModal.css'
import { VeteranBadge } from '../profile/VeteranBadge'

interface Props {
  onClose: () => void
}

export function VeteranWelcomeModal({ onClose }: Props) {
  return (
    <div className="veteran-modal-overlay" onClick={onClose}>
      <div className="veteran-modal" onClick={(e) => e.stopPropagation()}>
        <div className="veteran-modal__title">Une nouvelle ère commence.</div>
        <div className="veteran-modal__badge">
          <VeteranBadge size="lg" />
        </div>
        <p className="veteran-modal__body">
          Tu étais là avant. Le badge <strong>Vétéran de la Première Époque</strong> est désormais gravé sur ton profil — il restera à vie.
        </p>
        <p className="veteran-modal__body veteran-modal__body--sub">
          Tous les Veilleurs reprennent depuis le Niveau 1. Vos accomplissements antérieurs sont reconnus — par votre badge, et par notre mémoire.
        </p>
        <button className="veteran-modal__btn" onClick={onClose}>Reprendre la marche</button>
      </div>
    </div>
  )
}
