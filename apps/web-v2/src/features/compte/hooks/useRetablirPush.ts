/**
 * QUOI     — à l'ouverture de l'appli, réinscrit en base l'adresse push de ce téléphone.
 * POURQUOI — sans elle, un téléphone qui accepte les notifications mais que la base a oublié ne
 *            reçoit plus rien, sans que personne le voie (`lib/push.ts`, 05/11).
 * ATTENTION — un échec ne dit rien : la ligne « Sur ce téléphone » des Préférences reste le geste.
 */
import { useEffect } from 'react'
import { retablir } from '../lib/push'

export function useRetablirPush() {
  useEffect(() => {
    void retablir().catch(() => undefined)
  }, [])
}
