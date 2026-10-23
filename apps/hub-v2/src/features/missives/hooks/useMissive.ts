/**
 * QUOI     — le brouillon de l'écran Écrire : chargé depuis la base (une Missive rouverte) ou neuf, gardé en
 *            état, et les gestes qui partent vers la base : enregistrer, programmer, s'envoyer un essai.
 * POURQUOI — programmer et l'essai enregistrent d'abord : ce qui part est toujours ce qui est à l'écran.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Lettre } from '@runes/missives'
import { cuirePhoto, enregistrerMissive, envoyerEssai, lireMissive, programmerMissive } from '../api/missives'
import { brouillonVide, type Brouillon } from '../lib/brouillon'
import { lettrePourEnvoi } from '../lib/envoi'

export function useMissive(id: number | null) {
  const client = useQueryClient()
  const lue = useQuery({ queryKey: ['missive', id], queryFn: () => lireMissive(id ?? 0), enabled: id !== null })
  const [ecrit, setEcrit] = useState<Brouillon | null>(null)
  // Une photo déjà préparée pour ces couleurs ne se prépare pas deux fois (essai puis programmation).
  const [cuites] = useState(() => new Map<string, Promise<string>>())
  const brouillon = ecrit ?? lue.data ?? (id === null ? brouillonVide('missive') : null)

  function cuire(url: string, degres: number, couleur: string): Promise<string> {
    const cle = `${url}|${String(degres)}|${couleur}`
    const deja = cuites.get(cle)
    if (deja) return deja
    const promesse = cuirePhoto(url, degres, couleur)
    promesse.catch(() => cuites.delete(cle))
    cuites.set(cle, promesse)
    return promesse
  }

  async function enregistrer(b: Brouillon, envoi: Lettre | null = null): Promise<number> {
    const nouvelId = await enregistrerMissive(b, envoi)
    const enregistre = { ...b, id: nouvelId }
    setEcrit(enregistre)
    // Rouverte depuis Envois, la Missive montre ce qui vient d'être enregistré, pas une lecture plus ancienne.
    client.setQueryData(['missive', nouvelId], enregistre)
    await client.invalidateQueries({ queryKey: ['missives-envois'] })
    return nouvelId
  }

  return {
    brouillon,
    chargement: lue.isPending && id !== null,
    erreurDeLecture: lue.error,
    changer: setEcrit,
    enregistrer: useMutation({ mutationFn: (b: Brouillon) => enregistrer(b) }),
    programmer: useMutation({
      mutationFn: async ({ b, quand }: { b: Brouillon; quand: string | null }) => {
        await programmerMissive(await enregistrer(b, await lettrePourEnvoi(b.lettre, b.couleurs, cuire)), quand)
      },
    }),
    essai: useMutation({
      mutationFn: async (b: Brouillon) => {
        await envoyerEssai(await enregistrer(b, await lettrePourEnvoi(b.lettre, b.couleurs, cuire)))
      },
    }),
  }
}
