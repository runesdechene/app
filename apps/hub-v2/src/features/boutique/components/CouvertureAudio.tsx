/**
 * QUOI     — la couverture de la voix off : trois relevés (Illustrations sans voix off, Fragments enregistrés
 *            que personne n'a écoutés, produits sans Illustration reliée).
 * POURQUOI — chaque relevé se lit seul : « Lecture de l'inventaire… » tant qu'il attend, sa panne dans son
 *            propre bloc, jamais « 0 » avant d'avoir lu (le contresens constaté le 16/08).
 */
import type { UseQueryResult } from '@tanstack/react-query'
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { AccesShopifyRefuse } from '../api/shopify'
import { useEcoutes, useInventaireAudio, useProduitsSansIllustration } from '../hooks/useEcoutes'
import styles from './Ecoutes.module.css'

type Releve =
  | { etat: 'attente'; texte: string }
  | { etat: 'panne'; message: string }
  | { etat: 'lu'; noms: string[]; tronque: boolean }

const ATTENTE: Releve = { etat: 'attente', texte: 'Lecture de l’inventaire…' }

function panne(erreur: Error): Releve {
  const message = erreur instanceof AccesShopifyRefuse
    ? `la portée ${erreur.portee} manque à l’app Shopify.`
    : erreur.message
  return { etat: 'panne', message: `Inventaire indisponible : ${message}` }
}

// Un relevé d'après une lecture Shopify : `noms` en tire la liste une fois la lecture arrivée.
function releveDe<T extends { tronque: boolean }>(lecture: UseQueryResult<T>, noms: (data: T) => string[]): Releve {
  if (lecture.error) return panne(lecture.error)
  if (!lecture.data) return ATTENTE
  return { etat: 'lu', noms: noms(lecture.data), tronque: lecture.data.tronque }
}

function VueDuReleve({ titre, releve }: { titre: string; releve: Releve }) {
  return (
    <section aria-label={titre}>
      <Bloc>
        <div className={styles.releve}>
          <h3 className={styles.releveTitre}>{titre}</h3>
          {releve.etat === 'attente' && <p className={styles.calme}>{releve.texte}</p>}
          {releve.etat === 'panne' && <p role="alert" className={styles.erreur}>{releve.message}</p>}
          {releve.etat === 'lu' && (
            <>
              <p className={styles.releveNombre}>{releve.noms.length}</p>
              {releve.noms.length > 0 && <ul className={styles.noms}>{releve.noms.map((nom) => <li key={nom}>{nom}</li>)}</ul>}
              {releve.tronque && <p className={styles.calme}>liste tronquée</p>}
            </>
          )}
        </div>
      </Bloc>
    </section>
  )
}

export function CouvertureAudio() {
  const inventaire = useInventaireAudio()
  const ecoutes = useEcoutes()
  const produits = useProduitsSansIllustration()

  const sansVoix = releveDe(inventaire, (d) => d.illustrations.filter((i) => !i.aAudio).map((i) => i.nom))
  const muets = releveDe(produits, (d) => d.produits.map((p) => p.titre))

  // Les Illustrations avec voix off que les écoutes ne nomment pas : il faut les deux lectures.
  let jamaisEcoutes = releveDe(inventaire, (d) => {
    const dejaEcoutees = new Set(ecoutes.data?.map((l) => l.illustration_handle))
    return d.illustrations.filter((i) => i.aAudio && !dejaEcoutees.has(i.handle)).map((i) => i.nom)
  })
  if (jamaisEcoutes.etat === 'lu' && ecoutes.error) jamaisEcoutes = { etat: 'attente', texte: 'Écoutes illisibles : relevé impossible.' }
  else if (jamaisEcoutes.etat === 'lu' && !ecoutes.data) jamaisEcoutes = { etat: 'attente', texte: 'Lecture des écoutes…' }

  return (
    <section aria-label="Couverture" className={styles.section}>
      <TitreDeSection titre="Couverture de la voix off" />
      <div className={styles.releves}>
        <VueDuReleve titre="Illustrations sans voix off" releve={sansVoix} />
        <VueDuReleve titre="Fragments enregistrés que personne n’a écoutés" releve={jamaisEcoutes} />
        <VueDuReleve titre="Produits actifs sans Illustration reliée — le lecteur y reste muet" releve={muets} />
      </div>
    </section>
  )
}
