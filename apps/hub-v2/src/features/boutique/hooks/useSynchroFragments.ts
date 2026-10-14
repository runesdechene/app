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
      const mis = await synchroniserFragments(await lireIllustrations())
      void client.invalidateQueries({ queryKey: ['hub-illustrations'] })
      // Relus à neuf : la synchro a pu changer les images à calculer (et rafraîchit la liste affichée).
      const fragments = await client.query({ queryKey: ['hub-fragments'], queryFn: lireFragments, staleTime: 0 })
      const debut = `${String(mis)} ${pluriel(mis, 'Fragment')} mis à jour depuis Shopify`
      const visibles = fragments.filter((f) => f.visible)
      const echecs: string[] = []
      for (const [i, fragment] of visibles.entries()) {
        setCompteRendu(`${debut} · empreintes de scan : ${String(i)} / ${String(visibles.length)}…`)
        try {
          await recalculerEmpreintes(fragment)
        } catch {
          echecs.push(fragment.name)
        }
      }
      setCompteRendu(
        echecs.length === 0
          ? `${debut} · empreintes de scan recalculées`
          : `${debut} · empreintes de scan : ${String(visibles.length - echecs.length)} / ${String(visibles.length)}, échec pour ${echecs.join(', ')}`,
      )
      void client.invalidateQueries({ queryKey: ['hub-scans'] })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e))
    } finally {
      setEnCours(false)
    }
  }

  return { synchroniser, enCours, compteRendu, erreur }
}
