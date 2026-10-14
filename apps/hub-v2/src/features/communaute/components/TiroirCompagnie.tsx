/**
 * QUOI     — la fiche d'une Compagnie : son identité (modifiable : nom, devise, présentation, couleur)
 *            et ses membres.
 * POURQUOI — l'identifiant ne se change jamais (rename_faction est fermée, mig 512) : il est seulement affiché.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { dateCourte, moisAnnee } from '@/shared/lib/dates'
import { Balise, type Teinte } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { Tiroir } from '@/shared/ui/Tiroir'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { FicheDeCompagnie, Membre } from '../api/compagnies'
import { useCompagnie, useModifierCompagnie } from '../hooks/useCompagnie'
import { couleurValide } from '../lib/couleur'
import communaute from './Communaute.module.css'
import styles from './Compagnies.module.css'

const LISTE = '/communaute/compagnies'
const ROLES: Record<Membre['role'], { texte: string; teinte: Teinte }> = {
  chef: { texte: 'Chef', teinte: 'admin' },
  officier: { texte: 'Officier', teinte: 'porteur' },
  membre: { texte: 'Membre', teinte: 'boutique' },
}

function FormulaireIdentite({ fiche }: { fiche: FicheDeCompagnie }) {
  const modifier = useModifierCompagnie(fiche.id)
  const [nom, setNom] = useState(fiche.nom)
  const [devise, setDevise] = useState(fiche.devise ?? '')
  const [mission, setMission] = useState(fiche.mission ?? '')
  const [couleur, setCouleur] = useState(fiche.couleur)
  const [refus, setRefus] = useState('')
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    if (!enregistre) return
    const minuteur = setTimeout(() => { setEnregistre(false) }, 3000)
    return () => { clearTimeout(minuteur) }
  }, [enregistre])

  function enregistrer() {
    setEnregistre(false)
    modifier.reset()
    if (!couleurValide(couleur)) {
      setRefus('La couleur est un code #RRGGBB')
      return
    }
    setRefus('')
    modifier.mutate({ nom, devise, mission, couleur }, { onSuccess: () => { setEnregistre(true) } })
  }

  return (
    <Bloc className={styles.formulaire ?? ''}>
      <label className={styles.champ}>
        Nom
        <input type="text" value={nom} onChange={(e) => { setNom(e.target.value) }} />
      </label>
      <label className={styles.champ}>
        Devise
        <input type="text" value={devise} onChange={(e) => { setDevise(e.target.value) }} />
      </label>
      <label className={styles.champ}>
        Présentation
        <textarea rows={4} value={mission} onChange={(e) => { setMission(e.target.value) }} />
      </label>
      <label className={styles.champ}>
        Couleur
        <span className={styles.couleur}>
          <input type="text" value={couleur} onChange={(e) => { setCouleur(e.target.value) }} />
          <span className={styles.apercu} style={{ '--couleur': couleurValide(couleur) ? couleur : 'transparent' } as CSSProperties} />
        </span>
      </label>
      <div>
        <button type="button" className={communaute.boutonContour} disabled={modifier.isPending} onClick={enregistrer}>Enregistrer</button>
        {refus && <p role="alert">{refus}</p>}
        {modifier.isError && <p role="alert">{modifier.error.message}</p>}
        {enregistre && <p role="status">Enregistré.</p>}
      </div>
      <p className={styles.detail}>Identifiant : {fiche.id}</p>
    </Bloc>
  )
}

export function TiroirCompagnie() {
  const { id = '' } = useParams()
  const { data, isPending, isError, refetch } = useCompagnie(id)
  // La fiche est une route enfant : l'adresse garde les critères de la liste, on y revient avec.
  const retour = LISTE + useLocation().search

  if (isPending) {
    return (
      <Tiroir titre="Compagnie" retour={retour}>
        <p className={communaute.calme}>Lecture…</p>
      </Tiroir>
    )
  }
  if (isError) {
    return (
      <Tiroir titre="Compagnie" retour={retour}>
        <p>La fiche n’a pas pu être lue.</p>
        <button type="button" className={communaute.boutonContour} onClick={() => void refetch()}>Réessayer</button>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }
  if (data === null) {
    return (
      <Tiroir titre="Compagnie introuvable" retour={retour}>
        <p>Compagnie introuvable.</p>
        <Link to={retour}>Retour à la liste</Link>
      </Tiroir>
    )
  }

  return (
    <Tiroir titre={data.nom} retour={retour}>
      <div className={communaute.identite}>
        <span className={styles.grandePastille} style={{ '--couleur': data.couleur } as CSSProperties} />
        <div>
          <h1 className={communaute.nomFiche}>{data.nom}</h1>
          <div className={communaute.nomEtBalises}>
            {data.privee && <Balise texte="Privée" teinte="boutique" />}
            {data.retiree && <Balise texte="Retirée" teinte="sommeil" />}
          </div>
          <p className={styles.detail}>Fondée le {dateCourte(data.fondee)}</p>
        </div>
      </div>

      <TitreDeSection titre="Son identité" />
      <FormulaireIdentite key={data.id} fiche={data} />

      <TitreDeSection titre="Ses membres" />
      <Bloc>
        {data.membres.length === 0 && <p className={communaute.calme}>Aucun membre.</p>}
        {data.membres.map((m) => (
          <div key={m.id} className={styles.membre}>
            {m.avatar ? <img className={styles.portrait} src={m.avatar} alt="" loading="lazy" /> : <span className={styles.portrait} />}
            <span className={styles.nom}>{m.nom}</span>
            <Balise {...ROLES[m.role]} />
            <span className={styles.detail}>depuis {moisAnnee(m.depuis)}</span>
            <Link to={`/communaute/comptes/${m.id}`}>Voir le compte</Link>
          </div>
        ))}
      </Bloc>
    </Tiroir>
  )
}
