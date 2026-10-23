/**
 * QUOI     — le brouillon de l'écran Écrire : chargé depuis la base (une Missive rouverte) ou neuf, gardé en
 *            état, et les gestes qui partent vers la base : enregistrer, programmer, s'envoyer un essai.
 * POURQUOI — programmer et l'essai enregistrent d'abord : ce qui part est toujours ce qui est à l'écran.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Lettre, TitreEnImage } from '@runes/missives'
import { cuirePhoto, enregistrerMissive, envoyerEssai, lireMissive, programmerMissive } from '../api/missives'
import { brouillonVide, type Brouillon } from '../lib/brouillon'
import { lettrePourEnvoi } from '../lib/envoi'

/** Photographie les titres de la lettre affichée (lib/titres) : l'écran la fournit, lui seul a la lettre sous les yeux. */
export type Photographier = () => Promise<Record<string, TitreEnImage>>

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

  /** La lettre telle qu'elle part : photos penchées aux couleurs finales, titres en Bebas photographiés. */
  async function lettreQuiPart(b: Brouillon, titres: Photographier): Promise<Lettre> {
    const envoi = await lettrePourEnvoi(b.lettre, b.couleurs, cuire)
    return { ...envoi, contenu: { ...envoi.contenu, titresEnImages: await titres() } } as Lettre
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
    // Un e-mail de suite n'a pas de moment « Programmer » : il s'enregistre déjà tel qu'il partira.
    enregistrer: useMutation({
      mutationFn: async ({ b, titres }: { b: Brouillon; titres: Photographier }) =>
        enregistrer(b, b.etape === null ? null : await lettreQuiPart(b, titres)),
    }),
    programmer: useMutation({
      mutationFn: async ({ b, quand, titres }: { b: Brouillon; quand: string | null; titres: Photographier }) => {
        await programmerMissive(await enregistrer(b, await lettreQuiPart(b, titres)), quand)
      },
    }),
    essai: useMutation({
      mutationFn: async ({ b, titres }: { b: Brouillon; titres: Photographier }) => {
        await envoyerEssai(await enregistrer(b, await lettreQuiPart(b, titres)))
      },
    }),
  }
}
