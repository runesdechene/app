/**
 * QUOI     — l'aperçu d'un lieu, pour qui n'a pas de compte : la photo, le nom, la nature, la
 *            région et l'époque, le début du récit, combien de photos et d'Explorateurs ; puis
 *            l'invitation : « Crée ton compte pour découvrir ce lieu ».
 * POURQUOI — Uriel, 30/09 : voir un lieu sans compte, puis être amené à en créer un. Le reste
 *            (la suite du récit, la position, le Carnet, les cœurs) s'ouvre avec le compte ; le
 *            lieu est retenu, la fin de l'onboarding l'ouvre sur la carte.
 */
import { Link, useParams } from 'react-router'
import { retenirLieu } from '@/shared/lib/apresEntree'
import { useApercu } from '../hooks/useVitrine'
import styles from './ApercuLieu.module.css'

const NOMBRE = new Intl.NumberFormat('fr-FR')

function pluriel(n: number, mot: string) {
  return `${NOMBRE.format(n)} ${mot}${n > 1 ? 's' : ''}`
}

export function ApercuLieu() {
  const { id = '' } = useParams()
  const { apercu, erreur } = useApercu(id)

  if (apercu === undefined && !erreur) return <main className={styles.apercu} aria-busy="true" />

  if (!apercu) {
    return (
      <main className={styles.apercu}>
        <div className={styles.corps}>
          <p className={styles.absent}>Ce lieu ne se montre qu’aux Explorateurs.</p>
          <Link className={styles.retour} to="/bienvenue">
            Revenir à la recherche
          </Link>
        </div>
      </main>
    )
  }

  const lieu = apercu
  // « 12 photos · 3 Explorateurs y sont passés » : ce qui vaut zéro ne se dit pas.
  const traces = [
    lieu.photos > 0 && pluriel(lieu.photos, 'photo'),
    lieu.explorateurs > 0 &&
      `${pluriel(lieu.explorateurs, 'Explorateur')} ${lieu.explorateurs > 1 ? 'y sont passés' : 'y est passé'}`,
  ]
    .filter(Boolean)
    .join(' · ')
  const retenir = () => {
    retenirLieu(lieu.id)
  }

  return (
    <main className={styles.apercu}>
      <div className={styles.photo}>
        {lieu.photo && <img className={styles.image} src={lieu.photo} alt="" />}
        <Link className={styles.fleche} to="/bienvenue" aria-label="Revenir à la recherche" />
      </div>

      <div className={styles.corps}>
        <h1 className={styles.nom}>{lieu.nom}</h1>
        {lieu.nature && (
          <p
            className={styles.badge}
            style={lieu.nature.couleur ? { '--type': lieu.nature.couleur } : undefined}
          >
            {lieu.nature.icone && (
              <span
                className={styles.badgeIcone}
                style={{ '--icone': `url(${lieu.nature.icone})` }}
                aria-hidden="true"
              />
            )}
            {lieu.nature.nom}
          </p>
        )}
        {(lieu.region ?? lieu.epoque) && (
          <p className={styles.faits}>{[lieu.region, lieu.epoque].filter(Boolean).join(' · ')}</p>
        )}

        {lieu.extrait && (
          <p className={styles.recit} data-suite={lieu.suite || undefined}>
            {lieu.extrait}
          </p>
        )}

        {traces && <p className={styles.faits}>{traces}</p>}

        <div className={styles.invitation}>
          <p className={styles.promesse}>
            La suite du récit, le chemin jusqu’au lieu et son Carnet de passage s’ouvrent aux
            Explorateurs. C’est gratuit.
          </p>
          <Link className={styles.rejoindre} to="/bienvenue/preambule" onClick={retenir}>
            Crée ton compte pour découvrir ce lieu
          </Link>
          <Link className={styles.connecter} to="/bienvenue/email" onClick={retenir}>
            J’ai déjà un compte
          </Link>
        </div>
      </div>
    </main>
  )
}
