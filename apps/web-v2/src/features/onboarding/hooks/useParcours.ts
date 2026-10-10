/**
 * QUOI     — ce que l'onboarding porte d'un écran à l'autre : la connexion faite, l'e-mail.
 * POURQUOI — chaque écran est une adresse (/bienvenue/charte, /bienvenue/code…) ; ce qu'on a
 *            déjà dit voyage avec la navigation (son « état »), sans magasin maison. Un
 *            rechargement au milieu ramène simplement à l'étape qui manque.
 */
import { useLocation, useNavigate } from 'react-router'

// connecte : la connexion est faite ; fragments : ceux que l'e-mail vient de rapporter.
export type Parcours = {
  connecte: boolean
  email: string | null
  fragments: number
}
export type Etape = 'preambule' | 'charte' | 'email' | 'code' | 'nom' | 'calendrier' | 'fin'

function lireParcours(etat: unknown): Parcours {
  const p = typeof etat === 'object' && etat !== null ? etat : {}
  return {
    connecte: 'connecte' in p && p.connecte === true,
    email: 'email' in p && typeof p.email === 'string' ? p.email : null,
    fragments: 'fragments' in p && typeof p.fragments === 'number' ? p.fragments : 0,
  }
}

export function useParcours() {
  const location = useLocation()
  const navigate = useNavigate()
  const parcours = lireParcours(location.state)
  return {
    parcours,
    aller: (etape: Etape, suite: Partial<Parcours> = {}, remplacer = false) => {
      void navigate(`/bienvenue/${etape}`, {
        state: { ...parcours, ...suite },
        replace: remplacer,
      })
    },
  }
}
