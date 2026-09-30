/**
 * QUOI     — /bienvenue/carte : la carte pour qui n'a pas de compte, positions floutées ; et
 *            /bienvenue/carte/lieu/<id> : l'aperçu d'un lieu, au centre, par-dessus la carte.
 * POURQUOI — Uriel, 30/09 : le visiteur qui ferme l'aperçu profite de la carte, choisit d'autres
 *            lieux, et retrouve à chaque fois la même invitation à rejoindre. La carte vient de la
 *            zone Carte, l'aperçu de la vitrine : c'est ici qu'ils se rencontrent.
 * ATTENTION — le voile sous l'aperçu est un simple lien vers /bienvenue/carte : toucher à côté
 *            ferme l'aperçu, et le retour du navigateur le rouvre.
 */
import { Link, Outlet } from 'react-router'
import { CarteVisiteur } from '@/features/carte/components/CarteScreen'
import { ApercuLieu } from '@/features/vitrine/components/ApercuLieu'
import styles from './vitrine.module.css'

export function RouteCarteVisiteur() {
  return (
    <div className={styles.carte}>
      <CarteVisiteur />
      <div className={styles.invitation}>
        <Link className={styles.retour} to="/bienvenue" aria-label="Revenir à l’accueil" />
        <Link className={styles.rejoindre} to="/bienvenue/preambule">
          Commencer mon périple
        </Link>
      </div>
      <Outlet />
    </div>
  )
}

export function RouteApercuLieu() {
  return (
    <div className={styles.calque}>
      <Link className={styles.voile} to="/bienvenue/carte" aria-label="Fermer l’aperçu" />
      <div className={styles.fenetre}>
        <ApercuLieu />
      </div>
    </div>
  )
}
