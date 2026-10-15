/**
 * QUOI     — « Les bannières » : une carte par bannière (image, titre, Active / Inactive) ; « + Nouvelle bannière »
 *            envoie l'image puis ouvre la fiche ; la fiche s'ouvre par-dessus (route enfant).
 * POURQUOI — l'image se vérifie avant l'envoi (jpeg, png, webp, 5 Mo). La bannière naît inactive : tant que son
 *            titre et son lien ne sont pas posés, elle ne doit pas paraître sur l'Accueil des joueurs.
 */
import { useState, type ChangeEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { verifierFichier } from '@/shared/lib/envoi'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Banniere } from '../api/bannieres'
import { useBannieres, useEcritureBanniere } from '../hooks/useBannieres'
import { REGLE_IMAGE } from '../lib/banniere'
import styles from './Jeu.module.css'
import bannieres from './Bannieres.module.css'

function CarteDeBanniere({ banniere }: { banniere: Banniere }) {
  const { search } = useLocation()
  return (
    <Link className={bannieres.carte} to={{ pathname: String(banniere.id), search }}>
      <img src={banniere.image_url} alt="" loading="lazy" />
      <span className={bannieres.legende}>
        <strong>{banniere.title || '(sans titre)'}</strong>
        {banniere.active ? <span>Active</span> : <Balise texte="Inactive" teinte="sommeil" />}
      </span>
    </Link>
  )
}

export function Bannieres() {
  const { data, isError } = useBannieres()
  const { creer } = useEcritureBanniere()
  const { search } = useLocation()
  const naviguer = useNavigate()
  const [refus, setRefus] = useState<string | null>(null)

  function choisirImage(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    const erreur = verifierFichier(fichier, REGLE_IMAGE)
    setRefus(erreur)
    if (erreur) return
    creer.reset()
    creer.mutate(fichier, { onSuccess: (id) => { void naviguer({ pathname: String(id), search }) } })
  }

  const total = data?.length ?? 0
  const actives = data?.filter((b) => b.active).length ?? 0
  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Le jeu"
        titre="Les bannières"
        {...(data && { phrase: `${String(actives)} actives sur ${String(total)} — tirées au hasard sur l’Accueil d’Explore.` })}
        aDroite={
          <label className={[styles.boutonContour, bannieres.envoi].join(' ')}>
            + Nouvelle bannière
            <input type="file" accept={REGLE_IMAGE.types.join(',')} disabled={creer.isPending} onChange={choisirImage} />
          </label>
        }
      />
      {refus && <p role="alert">{refus}</p>}
      {creer.isError && <p role="alert">{creer.error.message}</p>}
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
      {data && (
        <Bloc>
          <div className={bannieres.grille}>{data.map((b) => <CarteDeBanniere key={b.id} banniere={b} />)}</div>
        </Bloc>
      )}
      <Outlet />
    </div>
  )
}
