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
import { fetchEntree, reclamerFragments, signerCharte, verifierCode } from '../api/entree'
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

  // Connecté, la Charte manquait : on la signe, puis on reprend.
  const signerPuisEntrer = useMutation({
    mutationFn: async () => {
      await signerCharte()
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
    signerPuisEntrer: () => {
      signerPuisEntrer.mutate()
    },
  }
}
