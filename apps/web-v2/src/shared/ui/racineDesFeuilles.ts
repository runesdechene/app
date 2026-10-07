/**
 * QUOI     — l'élément où toutes les feuilles se posent : la coquille le fournit.
 * POURQUOI — une feuille ouverte depuis le tiroir d'une fiche doit couvrir toute l'app, pas son
 *            seul conteneur ; sans racine (les faux téléphones de /da), elle reste sur place.
 */
import { createContext } from 'react'

export const RacineDesFeuilles = createContext<HTMLElement | null>(null)
