/**
 * QUOI     — mentionner en écrivant : la mention en cours (après « @ »), les Explorateurs qui
 *            répondent à ce qui est tapé, le choix de l'un d'eux, et les mentions à envoyer.
 * POURQUOI — le texte reste simple ; on retient à part qui a été choisi, et on n'envoie que ceux
 *            dont « @Nom » figure encore dans le message (la base vérifie de nouveau). Au clavier,
 *            les flèches parcourent la liste et Entrée mentionne (Uriel, 01/10).
 */
import { useQuery } from '@tanstack/react-query'
import { useState, type KeyboardEvent } from 'react'
import type { Personne } from '../api/lireRegistre'
import { chercherExplorateurs } from '../api/registre'
import { insererMention, mentionEnCours } from '../lib/mentions'

export function useMentions(texte: string, curseur: number) {
  const [choisies, setChoisies] = useState<Personne[]>([])
  // La proposition en surbrillance (flèches), et la recherche qu'Échap a fermée.
  const [actif, setActif] = useState(0)
  const [fermeePour, setFermeePour] = useState<string | null>(null)
  const enCours = mentionEnCours(
    texte,
    curseur,
    choisies.map((c) => c.nom),
  )
  const recherche = enCours?.recherche ?? ''
  const { data: trouves = [] } = useQuery({
    queryKey: ['explorateurs', recherche],
    queryFn: () => chercherExplorateurs(recherche),
    enabled: enCours !== null && recherche.trim().length > 0,
    staleTime: 60 * 1000,
  })
  const suggestions = enCours && recherche !== fermeePour ? trouves : []
  // Une autre liste : la surbrillance repart du haut.
  const [listeDe, setListeDe] = useState(recherche)
  if (listeDe !== recherche) {
    setListeDe(recherche)
    setActif(0)
  }

  const ajouter = (p: Personne) => {
    setChoisies((avant) => (avant.some((c) => c.id === p.id) ? avant : [...avant, p]))
  }
  const choisir = (p: Personne) => {
    ajouter(p)
    return insererMention(texte, curseur, p.nom)
  }

  return {
    suggestions,
    actif: Math.min(actif, Math.max(suggestions.length - 1, 0)),
    // Choisir un Explorateur : le texte et le curseur, avec « @Nom » à la place de ce qui était tapé.
    choisir,
    // Arrivé d'ailleurs (« Souhaite-lui la bienvenue ! ») : déjà mentionné, sans rien chercher.
    ajouter,
    // Le clavier dans la liste : ↑ ↓ pour choisir, Entrée pour mentionner, Échap pour fermer.
    // Rend la personne choisie à Entrée (sinon rien) ; l'événement ne va pas plus loin.
    clavier: (e: KeyboardEvent): Personne | null => {
      if (suggestions.length === 0) return null
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const pas = e.key === 'ArrowDown' ? 1 : -1
        setActif((i) => (i + pas + suggestions.length) % suggestions.length)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setFermeePour(recherche)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        return suggestions[Math.min(actif, suggestions.length - 1)] ?? null
      }
      return null
    },
    mentionsDe: (message: string) =>
      choisies.filter((p) => message.includes(`@${p.nom}`)).map((p) => p.id),
    oublier: () => {
      setChoisies([])
    },
  }
}
