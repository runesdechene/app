/**
 * QUOI     — le récit d'un Fragment (maquette 99:145) : d'où il vient, son nom, sa collection
 *            d'héritage, son illustration, les onglets « Son histoire » et « Ses énigmes »
 *            (verrouillé), sa voix off, le début de son histoire (« Lire tout le récit » déplie la
 *            suite), et « Acheter ce Fragment ».
 * POURQUOI — toucher un Fragment sur la carte ouvre son histoire, ouverte à tous ; ses énigmes, à
 *            créer, seront réservées à ses Porteurs (décision du 08/10).
 * ATTENTION — pas encore de scanner ni de Campement : leurs entrées de la maquette (l'icône du
 *            scanner, « Déjà Porteur ? Entrer au Campement ») attendent qu'ils existent.
 */
import { useState } from 'react'
import cadenas from '@/assets/ui/cadenas.svg'
import { aLaTaille } from '@/shared/lib/image'
import { Button } from '@/shared/ui/Button'
import { Text } from '@/shared/ui/Text'
import { useRecit } from '../hooks/useRecit'
import { lireTexteRiche, type Bloc } from '../lib/texteRiche'
import { LecteurAudio } from './LecteurAudio'
import styles from './RecitFragment.module.css'

const DEBUT = 2 // les paragraphes montrés avant « Lire tout le récit »

function Paragraphe({ bloc }: { bloc: Bloc }) {
  return (
    <p className={styles.paragraphe}>
      {bloc.map((s, i) => {
        if (s.gras) return <strong key={i}>{s.texte}</strong>
        if (s.italique) return <em key={i}>{s.texte}</em>
        return <span key={i}>{s.texte}</span>
      })}
    </p>
  )
}

export function RecitFragment({ id }: { id: number }) {
  const { recit, erreur, reessayer } = useRecit(id)
  const [toutLire, setToutLire] = useState(false)

  if (erreur) {
    return (
      <div className={styles.page}>
        <Text variant="corps">Ce récit n’a pas pu se charger.</Text>
        <Button
          kind="secondaire"
          onClick={() => {
            void reessayer()
          }}
        >
          Réessayer
        </Button>
      </div>
    )
  }
  if (recit === undefined) return null
  if (recit === null) {
    return (
      <div className={styles.page}>
        <Text variant="corps">Ce Fragment n’est plus visible.</Text>
      </div>
    )
  }

  const blocs = lireTexteRiche(recit.histoire)
  const montres = toutLire ? blocs : blocs.slice(0, DEBUT)
  return (
    <div className={styles.page}>
      <p className={styles.surtitre}>{recit.origine ?? 'Fragment'}</p>
      <h2 className={styles.nom}>{recit.nom}</h2>
      {recit.heritage && <p className={styles.heritage}>de la collection {recit.heritage}</p>}
      {recit.illustration && (
        <div className={styles.motif}>
          <img src={aLaTaille(recit.illustration, 164)} alt={`L’illustration de ${recit.nom}`} width={164} height={227} />
        </div>
      )}

      <div className={styles.onglets}>
        <span className={styles.onglet} aria-current="page">
          Son histoire
        </span>
        <span className={styles.ferme} title="Réservé aux Porteurs de ce Fragment">
          <img src={cadenas} alt="" width={12} height={15} />
          Ses énigmes
        </span>
      </div>

      {recit.audio && (
        <LecteurAudio src={recit.audio} ligne={recit.narrateur ? `Lu par ${recit.narrateur}` : recit.nom} />
      )}

      <div className={styles.histoire}>
        {montres.map((b, i) => (
          <Paragraphe key={i} bloc={b} />
        ))}
      </div>
      {!toutLire && blocs.length > DEBUT && (
        <button
          type="button"
          className={styles.lireTout}
          onClick={() => {
            setToutLire(true)
          }}
        >
          Lire tout le récit
        </button>
      )}

      {recit.boutique && (
        <div className={styles.acheter}>
          <Button href={recit.boutique}>Acheter ce Fragment</Button>
        </div>
      )}
    </div>
  )
}
