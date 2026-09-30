/**
 * QUOI     — /bienvenue/carte : la carte pour qui n'a pas de compte, positions floutées ;
 *            /bienvenue/carte/lieu/<id> : l'aperçu d'un lieu, au centre, par-dessus la carte ; et
 *            /bienvenue/<étape> : l'onboarding, qui sur PC se pose lui aussi en écran sur la carte.
 * POURQUOI — Uriel, 30/09 : le visiteur qui ferme l'aperçu profite de la carte, choisit d'autres
 *            lieux, et retrouve à chaque fois la même invitation à rejoindre. La carte vient de la
 *            zone Carte, l'aperçu de la vitrine : c'est ici qu'ils se rencontrent.
 *            Uriel, 30/09 : sur PC, tout l'onboarding fonctionne ainsi.
 * ATTENTION — le voile sous l'aperçu est un simple lien vers /bienvenue/carte : toucher à côté
 *            ferme l'aperçu, et le retour du navigateur le rouvre. Sous l'onboarding, le voile ne
 *            réagit pas : un clic égaré ne doit pas faire perdre une inscription en cours. Sur
 *            téléphone, l'onboarding reste plein écran et la carte n'est pas chargée.
 */
import { Link, Outlet } from 'react-router'
import { CarteVisiteur } from '@/features/carte/components/CarteScreen'
import { Onboarding } from '@/features/onboarding/components/Onboarding'
import { ApercuLieu } from '@/features/vitrine/components/ApercuLieu'
import { useConnecte } from '@/features/vitrine/hooks/useVitrine'
import { useSurOrdinateur } from '@/shared/hooks/useSurOrdinateur'
import styles from './vitrine.module.css'

export function RouteCarteVisiteur() {
  const connecte = useConnecte()
  return (
    <div className={styles.carte}>
      <CarteVisiteur />
      <div className={styles.invitation}>
        <Link className={styles.retour} to="/bienvenue" aria-label="Revenir à l’accueil" />
        <Link className={styles.rejoindre} to={connecte ? '/carte' : '/bienvenue/preambule'}>
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

export function RouteOnboarding() {
  const surOrdinateur = useSurOrdinateur()
  if (!surOrdinateur) return <Onboarding />
  return (
    <div className={styles.carte}>
      <CarteVisiteur />
      <div className={styles.calque}>
        <div className={styles.voile} aria-hidden="true" />
        <div className={[styles.fenetre, styles.ecran].join(' ')}>
          <Onboarding />
        </div>
      </div>
    </div>
  )
}
