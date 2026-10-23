/**
 * QUOI     — le brouillon de l'écran Écrire : chargé depuis la base (une Missive rouverte) ou neuf, gardé en
 *            état, et les gestes qui partent vers la base : enregistrer, programmer, s'envoyer un essai.
 * POURQUOI — programmer et l'essai enregistrent d'abord : ce qui part est toujours ce qui est à l'écran.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { enregistrerMissive, envoyerEssai, lireMissive, programmerMissive } from '../api/missives'
import { brouillonVide, type Brouillon } from '../lib/brouillon'

export function useMissive(id: number | null) {
  const client = useQueryClient()
  const lue = useQuery({ queryKey: ['missive', id], queryFn: () => lireMissive(id ?? 0), enabled: id !== null })
  const [ecrit, setEcrit] = useState<Brouillon | null>(null)
  const brouillon = ecrit ?? lue.data ?? (id === null ? brouillonVide('missive') : null)

  async function enregistrer(b: Brouillon): Promise<number> {
    const nouvelId = await enregistrerMissive(b)
    setEcrit({ ...b, id: nouvelId })
    await client.invalidateQueries({ queryKey: ['missives-envois'] })
    return nouvelId
  }

  return {
    brouillon,
    chargement: lue.isPending && id !== null,
    erreurDeLecture: lue.error,
    changer: setEcrit,
    enregistrer: useMutation({ mutationFn: enregistrer }),
    programmer: useMutation({
      mutationFn: async ({ b, quand }: { b: Brouillon; quand: string | null }) => {
        await programmerMissive(await enregistrer(b), quand)
      },
    }),
    essai: useMutation({ mutationFn: async (b: Brouillon) => { await envoyerEssai(await enregistrer(b)) } }),
  }
}
