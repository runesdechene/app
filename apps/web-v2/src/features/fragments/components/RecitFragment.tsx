/**
 * QUOI     — le récit d'un Fragment (maquette 99:145) : d'où il vient, son nom, sa collection
 *            d'héritage, son motif à nu, sa voix off et son histoire. Au Porteur (`porteur`, depuis
 *            sa fiche du Codex) : l'histoire entière, rien à acheter. Ailleurs (la vitrine) : le
 *            début, « Lire tout le récit », et « Acheter ce Fragment ».
 * POURQUOI — ses énigmes ne se feront pas pour l'instant (Uriel, 03/11) : les anecdotes en tiennent
 *            lieu. La vraie page « histoire » du Porteur se maquettera après jeudi (spec du Codex).
 *            Jamais d'italique (.claude/rules/interface.md) : un passage en italique se lit en romain.
 */
import { useState } from 'react'
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
        return <span key={i}>{s.texte}</span>
      })}
    </p>
  )
}

export function RecitFragment({ id, porteur = false }: { id: number; porteur?: boolean }) {
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
  const montres = porteur || toutLire ? blocs : blocs.slice(0, DEBUT)
  return (
    <div className={styles.page}>
      <p className={styles.surtitre}>{recit.origine ?? 'Fragment'}</p>
      <h2 className={styles.nom}>{recit.nom}</h2>
      {recit.heritage && <p className={styles.heritage}>de la collection {recit.heritage}</p>}
      {recit.illustration && (
        <div className={styles.motif}>
          <img src={aLaTaille(recit.illustration, 280)} alt={`L’illustration de ${recit.nom}`} />
        </div>
      )}

      {recit.audio && (
        <LecteurAudio
          src={recit.audio}
          ligne={recit.narrateur ? `Lu par ${recit.narrateur}` : recit.nom}
        />
      )}

      <div className={styles.histoire}>
        {montres.map((b, i) => (
          <Paragraphe key={i} bloc={b} />
        ))}
      </div>
      {!porteur && !toutLire && blocs.length > DEBUT && (
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

      {!porteur && recit.boutique && (
        <div className={styles.acheter}>
          <Button href={recit.boutique}>Acheter ce Fragment</Button>
        </div>
      )}
    </div>
  )
}
