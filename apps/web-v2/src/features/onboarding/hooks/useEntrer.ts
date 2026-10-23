/**
 * QUOI     — entrer avec le code reçu : la connexion, puis ce qui en découle — les Fragments
 *            achetés avec cet e-mail rejoignent le compte — et l'écran suivant : la Charte (si
 *            elle manque), le nom (s'il manque), la bienvenue.
 * POURQUOI — la Charte se signe une fois, connecté : avant l'e-mail, on ne sait pas qui entre, et
 *            un compte qui l'avait déjà signée la resignait (Uriel, 08/10). Un nom déjà choisi ne
 *            se redemande pas.
 * ATTENTION — réclamer les Fragments ne doit pas bloquer l'entrée : un échec vaut « aucun ».
 */
import { useMutation } from '@tanstack/react-query'
import { VERSION_DES_CONDITIONS } from '@/shared/lib/conditions'
import { accepterConditions } from '@/shared/supabase/conditions'
import { donnerAccordNouvelles, fetchEntree, reclamerFragments, signerCharte, verifierCode } from '../api/entree'
import type { Entree } from '../api/lireEntree'
import { useParcours } from './useParcours'

export function useEntrer() {
  const { parcours, aller } = useParcours()

  const suite = (entree: Entree, fragments: number) => {
    const etat = { connecte: true, fragments }
    if (!entree.charteSignee) aller('charte', etat, true)
    else if (!entree.nom) aller('nom', etat, true)
    else aller('fin', etat, true)
  }

  const entrer = useMutation({
    mutationFn: async (code: string) => {
      const email = parcours.email ?? ''
      const moi = await verifierCode(email, code)
      const fragments = await reclamerFragments(moi, email).catch(() => 0)
      return { entree: await fetchEntree(), fragments }
    },
    onSuccess: ({ entree, fragments }) => {
      suite(entree, fragments)
    },
  })

  // Connecté, la Charte manquait : on la signe avec les conditions (case cochée), puis on reprend.
  // L'accord aux nouvelles, s'il est coché, ne bloque jamais l'entrée.
  const signerPuisEntrer = useMutation({
    mutationFn: async (nouvelles: boolean) => {
      await signerCharte()
      await accepterConditions(VERSION_DES_CONDITIONS)
      if (nouvelles) await donnerAccordNouvelles().catch(() => undefined)
      return fetchEntree()
    },
    onSuccess: (entree) => {
      suite(entree, parcours.fragments)
    },
  })

  return {
    entrer: (code: string) => {
      entrer.mutate(code)
    },
    enCours: entrer.isPending,
    codeRefuse: entrer.isError,
    signerPuisEntrer: (nouvelles: boolean) => {
      signerPuisEntrer.mutate(nouvelles)
    },
  }
}
