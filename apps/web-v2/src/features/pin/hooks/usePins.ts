/**
 * QUOI     — mes pins (serveur + en attente), leur envoi automatique, poser et supprimer.
 * POURQUOI — un seul cache (['pins']) pour la feuille du « + », la carte et la petite carte d'un
 *            pin. Poser écrit d'abord dans le téléphone : le pin existe même sans réseau.
 * ATTENTION — `useEnvoyerPins` est monté une fois, dans la coquille : au lancement et à chaque
 *            retour du réseau.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useEnLigne } from '@/shared/hooks/useEnLigne'
import type { Point } from '@/shared/lib/distance'
import { joursRestants, VALIDITE_JOURS } from '@/shared/lib/validitePin'
import { fetchMesPins, supprimerPin } from '../api/pins'
import { envoyerPinsEnAttente } from '../lib/envoyer'
import { garderPinEnAttente, lirePinsEnAttente, retirerPinEnAttente } from '../lib/pinsEnAttente'

export const PINS = ['pins'] as const

export type PinAffiche = {
  id: string
  point: Point
  lieuDit: string | null
  poseLe: Date
  jours: number
  enAttente: boolean
  refuse: boolean // en attente, mais refusé par le serveur : à supprimer
}

export async function lireTout(): Promise<PinAffiche[]> {
  const maintenant = new Date()
  const enAttente = (await lirePinsEnAttente()).map((p) => {
    const poseLe = new Date(p.poseLe)
    return {
      id: p.id,
      point: { latitude: p.latitude, longitude: p.longitude },
      lieuDit: null,
      poseLe,
      jours: joursRestants(poseLe, maintenant),
      enAttente: true,
      refuse: p.refuse === true,
    }
  })
  // Hors ligne, le serveur ne répond pas : on montre au moins les pins du téléphone. En ligne, une
  // erreur (500, jeton expiré) remonte : la requête garde ses données précédentes et réessaie.
  const serveur = await fetchMesPins().catch((e: unknown) => {
    if (navigator.onLine) throw e
    return { validiteJours: VALIDITE_JOURS, pins: [] }
  })
  const envoyes = serveur.pins
    .filter((p) => !enAttente.some((a) => a.id === p.id))
    .map((p) => ({ ...p, jours: joursRestants(p.poseLe, maintenant, serveur.validiteJours), enAttente: false, refuse: false }))
  return [...enAttente, ...envoyes]
}

export function useMesPins(): PinAffiche[] {
  return useQuery({ queryKey: PINS, queryFn: lireTout, networkMode: 'always' }).data ?? []
}

export function useEnvoyerPins(): void {
  const enLigne = useEnLigne()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enLigne) return
    void envoyerPinsEnAttente()
      .then((e) => {
        // Un pin refusé change d'état à l'écran, comme un pin envoyé.
        if (e.envoyes > 0 || e.refuses.length > 0) void queryClient.invalidateQueries({ queryKey: PINS })
      })
      .catch(() => undefined) // IndexedDB refusé : on réessaiera au prochain déclencheur
  }, [enLigne, queryClient])
}

export function usePoserPin() {
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ point, precision }: { point: Point; precision: number }) => {
      await garderPinEnAttente({
        id: crypto.randomUUID(),
        latitude: point.latitude,
        longitude: point.longitude,
        precision: Math.round(precision),
        poseLe: new Date().toISOString(),
      })
      await envoyerPinsEnAttente().catch(() => undefined)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PINS }),
  })
}

export function useSupprimerPin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (p: PinAffiche) => (p.enAttente ? retirerPinEnAttente(p.id) : supprimerPin(p.id)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: PINS }),
  })
}
