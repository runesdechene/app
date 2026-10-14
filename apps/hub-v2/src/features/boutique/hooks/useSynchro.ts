/**
 * QUOI     — la liaison comptes-clients et la pose des étiquettes de provenance, avec leur progression.
 * POURQUOI — la liaison change les comptes : la liste des comptes se relit. La pose lit tout (comptes reliés,
 *            clients Shopify), prépare les lots puis les envoie en montrant « fait / total » ; une erreur
 *            avant l'envoi arrête tout sans rien poser.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { lireClientsShopify } from '../api/shopify'
import { envoyerEtiquettes, lireComptesClients, relierComptesEtClients } from '../api/synchro'
import { envoyerParLots, preparerEtiquetage, type Progres } from '../lib/provenance'

export type FinDePose = Progres & { ignores: number }

export function useLiaison() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: relierComptesEtClients,
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-comptes'] }),
  })
}

export function usePoseDesEtiquettes() {
  const [progres, setProgres] = useState<Progres | null>(null)
  const pose = useMutation({
    mutationFn: async (): Promise<FinDePose> => {
      setProgres(null)
      const [comptes, clients] = await Promise.all([lireComptesClients(), lireClientsShopify()])
      const { lots, ignores } = preparerEtiquetage(comptes, clients)
      const fin = await envoyerParLots(lots, envoyerEtiquettes, setProgres)
      return { ...fin, ignores }
    },
  })
  return { ...pose, progres }
}
