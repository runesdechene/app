/**
 * QUOI     — la synchro des Fragments depuis Shopify : lire les Illustrations, mettre les Fragments à jour,
 *            puis recalculer les empreintes de scan de ceux qui sont visibles.
 * POURQUOI — le compte rendu avance à chaque étape (le calcul est long). Un Fragment dont l'empreinte
 *            échoue est nommé sans arrêter les autres ; une erreur avant les empreintes arrête tout et
 *            s'affiche telle que reçue.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { pluriel } from '@/shared/lib/texte'
import { lireFragments, synchroniserFragments } from '../api/fragments'
import { recalculerEmpreintes } from '../api/scan'
import { lireIllustrations } from '../api/shopify'

type Echec = { nom: string; cause: string }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// « Hoplite, Loup (image refusée) » : les Fragments qui partagent une cause la disent une seule fois.
function echecsEnPhrase(echecs: Echec[]): string {
  const causes = [...new Set(echecs.map((e) => e.cause))]
  return causes.map((cause) => `${echecs.filter((e) => e.cause === cause).map((e) => e.nom).join(', ')} (${cause})`).join(' ; ')
}

export function useSynchroFragments() {
  const client = useQueryClient()
  const [enCours, setEnCours] = useState(false)
  const [compteRendu, setCompteRendu] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function synchroniser() {
    setEnCours(true)
    setErreur(null)
    setCompteRendu(null)
    try {
      let illustrations
      try {
        illustrations = await lireIllustrations()
      } catch (e) {
        setErreur(`Shopify ne répond pas : ${message(e)}`)
        return
      }
      const mis = await synchroniserFragments(illustrations)
      void client.invalidateQueries({ queryKey: ['hub-illustrations'] })
      // La base est à jour : la liste affichée se rafraîchit, même si la relecture ci-dessous échoue.
      void client.invalidateQueries({ queryKey: ['hub-fragments'] })
      const debut = `${String(mis)} ${pluriel(mis, 'Fragment')} mis à jour depuis Shopify`
      setCompteRendu(debut)
      let fragments
      try {
        // Relus à neuf : la synchro a pu changer les images à calculer.
        fragments = await client.query({ queryKey: ['hub-fragments'], queryFn: lireFragments, staleTime: 0 })
      } catch (e) {
        setErreur(`Les Fragments sont synchronisés, mais la liste n’a pas pu être relue : ${message(e)}`)
        return
      }
      const visibles = fragments.filter((f) => f.visible)
      const echecs: Echec[] = []
      for (const [i, fragment] of visibles.entries()) {
        setCompteRendu(`${debut} · empreintes de scan : ${String(i)} / ${String(visibles.length)}…`)
        try {
          await recalculerEmpreintes(fragment)
        } catch (e) {
          echecs.push({ nom: fragment.name, cause: message(e) })
        }
      }
      setCompteRendu(
        echecs.length === 0
          ? `${debut} · empreintes de scan recalculées`
          : `${debut} · empreintes de scan : ${String(visibles.length - echecs.length)} / ${String(visibles.length)}, échec pour ${echecsEnPhrase(echecs)}`,
      )
      void client.invalidateQueries({ queryKey: ['hub-scans'] })
    } catch (e) {
      setErreur(message(e))
    } finally {
      setEnCours(false)
    }
  }

  return { synchroniser, enCours, compteRendu, erreur }
}
