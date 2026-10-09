/**
 * QUOI     — mes pins (serveur + en attente), leur envoi automatique, poser et supprimer.
 * POURQUOI — un seul cache (['pins']) pour la feuille du « + », la carte et la petite carte d'un
 *            pin. Poser écrit d'abord dans le téléphone : le pin existe même sans réseau.
 * ATTENTION — poser rend la main dès le pin gardé : l'envoi part derrière, jamais attendu (un
 *            réseau faible ou un jeton à rafraîchir le fait durer des dizaines de secondes).
 *            `useEnvoyerPins` est monté une fois, dans la coquille : au lancement, au retour du
 *            réseau et au retour dans l'app ; `useEnvoyerALOuverture`, à l'ouverture du « + ».
 *            Un serveur muet ne fait jamais disparaître un pin : la liste garde ceux qu'elle
 *            connaissait.
 */
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useEnLigne } from '@/shared/hooks/useEnLigne'
import type { Point } from '@/shared/lib/distance'
import { joursRestants } from '@/shared/lib/validitePin'
import { fetchMesPins, supprimerPin } from '../api/pins'
import type { Pin } from '../api/lirePins'
import { envoyerPinsEnAttente } from '../lib/envoyer'
import { garderPinEnAttente, lirePinsEnAttente, retirerPinEnAttente } from '../lib/pinsEnAttente'

export const PINS = ['pins'] as const
// Le compte connecté : la clé de `useMonIdentifiant` (zone compte), en clé littérale — une zone
// n'en importe pas une autre. Les deux lisent la même session.
const MOI = ['moi'] as const

export type PinAffiche = {
  id: string
  point: Point
  lieuDit: string | null
  poseLe: Date
  jours: number
  enAttente: boolean
  refuse: boolean // en attente, mais refusé par le serveur : à supprimer
}

export async function lireTout(queryClient: QueryClient): Promise<PinAffiche[]> {
  const maintenant = new Date()
  // Sans rien attendre : hors ligne avec un jeton expiré, lire la session dure ~30 s. Compte
  // inconnu (`undefined`, `null`) : tout se montre ; seul un pin d'un autre compte connu se cache.
  const moi = queryClient.getQueryData<string | null>(MOI)
  const tous = await lirePinsEnAttente()
  const enAttente = tous
    .filter((p) => !p.userId || !moi || p.userId === moi)
    .map((p) => {
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
  const envoye = (p: Pin, validite?: number): PinAffiche => ({
    id: p.id,
    point: p.point,
    lieuDit: p.lieuDit,
    poseLe: p.poseLe,
    jours: joursRestants(p.poseLe, maintenant, validite),
    enAttente: false,
    refuse: false,
  })
  // Ceux du serveur que la liste connaissait déjà : gardés quand il ne répond pas.
  // Un pin affiché en attente qui n'est plus dans le téléphone vient de partir : il se montre envoyé.
  const connus = () =>
    (queryClient.getQueryData<PinAffiche[]>(PINS) ?? [])
      .filter((p) => !p.enAttente || !tous.some((t) => t.id === p.id))
      .map((p) => envoye(p))
  let serveur: PinAffiche[]
  if (!navigator.onLine) {
    serveur = connus()
  } else {
    try {
      const r = await fetchMesPins()
      serveur = r.pins.map((p) => envoye(p, r.validiteJours))
    } catch (e) {
      serveur = connus()
      // Rien à montrer de toute façon : l'erreur remonte, la requête réessaiera.
      if (serveur.length === 0 && enAttente.length === 0) throw e
    }
  }
  return [...enAttente, ...serveur.filter((p) => !enAttente.some((a) => a.id === p.id))]
}

// `undefined` tant que la liste n'est pas arrivée : une adresse de pin attend avant de conclure
// qu'il n'existe pas.
export function useMesPinsCharges(): PinAffiche[] | undefined {
  const queryClient = useQueryClient()
  return useQuery({ queryKey: PINS, queryFn: () => lireTout(queryClient), networkMode: 'always' })
    .data
}

export function useMesPins(): PinAffiche[] {
  return useMesPinsCharges() ?? []
}

// Envoie derrière, sans jamais être attendu ; la liste se relit si un pin a changé d'état (un pin
// refusé change d'écran, comme un pin envoyé). Sans réseau, rien n'est tenté.
function envoyerDerriere(queryClient: QueryClient): void {
  if (!navigator.onLine) return
  void envoyerPinsEnAttente()
    .then((e) => {
      if (e.envoyes > 0 || e.refuses.length > 0)
        void queryClient.invalidateQueries({ queryKey: PINS })
    })
    .catch(() => undefined) // IndexedDB refusé : on réessaiera au prochain déclencheur
}

export function useEnvoyerPins(): void {
  const enLigne = useEnLigne()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (enLigne) envoyerDerriere(queryClient)
  }, [enLigne, queryClient])
  // Un réseau faible ne déclenche pas d'événement `online` : revenir dans l'app relance l'envoi.
  useEffect(() => {
    const auRetour = () => {
      if (document.visibilityState === 'visible') envoyerDerriere(queryClient)
    }
    document.addEventListener('visibilitychange', auRetour)
    return () => {
      document.removeEventListener('visibilitychange', auRetour)
    }
  }, [queryClient])
}

// L'ouverture du « + » (spec, écran 0) : les pins en attente partent, la liste se met à jour.
export function useEnvoyerALOuverture(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    envoyerDerriere(queryClient)
  }, [queryClient])
}

// Rend l'id du pin posé : l'écran suit ensuite son état (en attente, ou envoyé) dans la liste.
export function usePoserPin() {
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ point, precision }: { point: Point; precision: number }) => {
      const id = crypto.randomUUID()
      // Le compte connu à l'instant, sans rien attendre ; inconnu, le pin suivra la session.
      const moi = queryClient.getQueryData<string | null>(MOI)
      await garderPinEnAttente({
        id,
        latitude: point.latitude,
        longitude: point.longitude,
        precision: Math.round(precision),
        poseLe: new Date().toISOString(),
        ...(moi ? { userId: moi } : {}),
      })
      return id
    },
    onSuccess: () => {
      envoyerDerriere(queryClient)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PINS }),
  })
}

// Un pin du téléphone se supprime sans réseau : la mutation ne se met jamais en pause.
export function useSupprimerPin() {
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'always',
    mutationFn: async (p: PinAffiche) => {
      if (!p.enAttente) return supprimerPin(p.id)
      // Plus dans le téléphone : il est parti entre-temps, le serveur l'a. Hors ligne, la
      // prochaine lecture de la liste le montrera de nouveau.
      if (!(await retirerPinEnAttente(p.id)) && navigator.onLine)
        await supprimerPin(p.id).catch(() => undefined)
    },
    // Sorti du cache tout de suite : une relecture ratée ne doit pas le « ressusciter ».
    onSuccess: (_r, p) => {
      queryClient.setQueryData<PinAffiche[]>(PINS, (liste) => liste?.filter((x) => x.id !== p.id))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PINS }),
  })
}
