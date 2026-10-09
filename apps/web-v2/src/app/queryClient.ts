/**
 * QUOI     — l'instance TanStack Query partagée par toute l'app, et ce qu'elle garde sur
 *            l'appareil entre deux ouvertures : les lieux de la carte et l'accès accordé.
 * POURQUOI — un seul cache : deux écrans qui demandent la même donnée ne la chargent qu'une fois.
 *            Les lieux gardés (Uriel, 02/10 : « oui pour garder les lieux ») : la carte s'affiche
 *            dès l'ouverture, puis se met à jour derrière. Dans IndexedDB (~1,5 Mo) : le
 *            localStorage, partagé avec la V1, est trop petit.
 * ATTENTION — le cache gardé est effacé à la déconnexion (`oublierLeCache`) et à chaque nouvelle
 *            version (`buster`) : un format qui change ne relit jamais d'anciennes données.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient, type QueryKey, type QueryStatus } from '@tanstack/react-query'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { carteLieuxKey } from '@/features/carte/hooks/useCarteLieux'

const SEPT_JOURS = 7 * 24 * 60 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

// Gardés une semaine : la requête doit vivre aussi longtemps que sa copie sur l'appareil.
queryClient.setQueryDefaults(carteLieuxKey, { gcTime: SEPT_JOURS })
queryClient.setQueryDefaults(['v2-access'], { gcTime: SEPT_JOURS })

// L'accès accordé se garde aussi : sans lui, l'app ne s'ouvre pas hors ligne (pin GPS, 06/10).
// Un refus ne se garde jamais : il se redemande.
export function aGarderSurLAppareil(cle: QueryKey, etat: QueryStatus, donnees: unknown): boolean {
  if (etat !== 'success') return false
  if (cle[0] === carteLieuxKey[0] && cle[1] === carteLieuxKey[1]) return true
  return (
    cle[0] === 'v2-access' &&
    typeof donnees === 'object' &&
    donnees !== null &&
    'hasAccess' in donnees &&
    donnees.hasAccess === true
  )
}

// Pendant la relecture de la copie, TanStack met toutes les requêtes en pause — l'accès compris.
// Une relecture qui traîne (IndexedDB indisponible, navigation privée) ne doit jamais figer l'app :
// passé le délai, on repart sans la copie.
const RELECTURE_MAX = 1500

export function auPlusTard<T>(lecture: Promise<T>, ms: number): Promise<T | undefined> {
  const delai = new Promise<undefined>((fini) => {
    setTimeout(() => {
      fini(undefined)
    }, ms)
  })
  return Promise.race([lecture, delai])
}

const persister = createAsyncStoragePersister({
  key: 'explore-v2',
  storage: {
    getItem: (cle) => auPlusTard(get<string>(cle), RELECTURE_MAX),
    setItem: (cle, valeur: string) => set(cle, valeur),
    removeItem: (cle) => del(cle),
  },
})

export const persistance: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: SEPT_JOURS,
  buster: __VERSION__,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      aGarderSurLAppareil(query.queryKey, query.state.status, query.state.data),
  },
}

async function effacerLaCopie() {
  try {
    await persister.removeClient()
  } catch {
    // Sans IndexedDB (navigation privée, tests), il n'y a rien à effacer.
  }
}

// À la déconnexion : rien de la session ne reste, ni en mémoire ni sur l'appareil.
export function oublierLeCache() {
  queryClient.clear()
  void effacerLaCopie()
}
