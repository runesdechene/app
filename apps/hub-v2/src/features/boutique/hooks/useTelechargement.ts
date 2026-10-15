/**
 * QUOI     — un téléchargement d'archive qui dit où il en est : « Téléchargement 2/5… », puis ce qui n'a pas
 *            pu être lu, ou l'erreur.
 * POURQUOI — la contribution et l'en-tête de l'écran téléchargent de la même façon ; l'état (état React)
 *            vit ici, le travail dans lib/archive.
 */
import { useState } from 'react'
import { pluriel } from '@/shared/lib/texte'
import { telechargerArchive, type Fichier } from '../lib/archive'

export function useTelechargement() {
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function telecharger(fichiers: Fichier[], nomDArchive: string) {
    setEnCours(true)
    setErreur(null)
    setMessage(null)
    try {
      const { manques } = await telechargerArchive(fichiers, nomDArchive, (fait, total) => {
        setMessage(`Téléchargement ${String(fait)}/${String(total)}…`)
      })
      setMessage(manques > 0 ? `${String(manques)} ${pluriel(manques, 'fichier')} ${pluriel(manques, 'n’a', 'n’ont')} pas pu être ${pluriel(manques, 'lu')}.` : null)
    } catch (e) {
      setMessage(null)
      setErreur(e instanceof Error ? e.message : 'Le téléchargement a échoué.')
    } finally {
      setEnCours(false)
    }
  }

  return { telecharger, enCours, message, erreur }
}
