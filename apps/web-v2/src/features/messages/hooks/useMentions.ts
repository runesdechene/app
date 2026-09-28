/**
 * QUOI     — mentionner en écrivant : la mention en cours (après « @ »), les Explorateurs qui
 *            répondent à ce qui est tapé, le choix de l'un d'eux, et les mentions à envoyer.
 * POURQUOI — le texte reste simple ; on retient à part qui a été choisi, et on n'envoie que ceux
 *            dont « @Nom » figure encore dans le message (la base vérifie de nouveau).
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { Personne } from '../api/lireRegistre'
import { chercherExplorateurs } from '../api/registre'
import { insererMention, mentionEnCours } from '../lib/mentions'

export function useMentions(texte: string, curseur: number) {
  const [choisies, setChoisies] = useState<Personne[]>([])
  const enCours = mentionEnCours(texte, curseur)
  const recherche = enCours?.recherche ?? ''
  const { data: suggestions = [] } = useQuery({
    queryKey: ['explorateurs', recherche],
    queryFn: () => chercherExplorateurs(recherche),
    enabled: enCours !== null && recherche.length > 0,
    staleTime: 60 * 1000,
  })

  return {
    suggestions: enCours ? suggestions : [],
    // Choisir un Explorateur : le texte et le curseur, avec « @Nom » à la place de ce qui était tapé.
    choisir: (p: Personne) => {
      setChoisies((avant) => (avant.some((c) => c.id === p.id) ? avant : [...avant, p]))
      return insererMention(texte, curseur, p.nom)
    },
    mentionsDe: (message: string) =>
      choisies.filter((p) => message.includes(`@${p.nom}`)).map((p) => p.id),
    oublier: () => {
      setChoisies([])
    },
  }
}
