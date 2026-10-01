import { goToV2 } from '../../lib/v2Access'

// Le chemin permanent vers la nouvelle Explore, pour qui a fermé le pop-up : même bandeau doré
// que « Mise à jour disponible », aux mêmes endroits (haut de la carte, haut de l'accueil).
// Code de transition : supprimé avec la V1.
export function NouvelleExploreBandeau() {
  return (
    <button className="update-banner" onClick={goToV2}>
      <span className="update-banner-icon" aria-hidden>✨</span>
      <span className="update-banner-text">
        La nouvelle Explore est là — touche ici pour l'essayer
      </span>
    </button>
  )
}
