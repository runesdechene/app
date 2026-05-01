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
          Tous les Veilleurs reprennent avec leurs accomplissements depuis le 1er mars. Les anciens gagnent un bonus réduit sur les lieux ajoutés avant cette date.
        </p>
        <button className="veteran-modal__btn" onClick={onClose}>Accepter cet honneur</button>
      </div>
    </div>
  )
}
