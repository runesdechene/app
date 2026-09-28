/**
 * QUOI     — ce que l'onboarding porte d'un écran à l'autre : la Charte signée, l'e-mail.
 * POURQUOI — chaque écran est une adresse (/bienvenue/charte, /bienvenue/code…) ; ce qu'on a
 *            déjà dit voyage avec la navigation (son « état »), sans magasin maison. Un
 *            rechargement au milieu ramène simplement à l'étape qui manque.
 */
import { useLocation, useNavigate } from 'react-router'

// charte : signée avant de se connecter ; connecte : la connexion est faite (la Charte manquait) ;
// fragments : ceux que l'e-mail vient de rapporter.
export type Parcours = {
  charte: boolean
  connecte: boolean
  email: string | null
  fragments: number
}
export type Etape = 'preambule' | 'charte' | 'email' | 'code' | 'nom' | 'fin'

function lireParcours(etat: unknown): Parcours {
  const p = typeof etat === 'object' && etat !== null ? etat : {}
  return {
    charte: 'charte' in p && p.charte === true,
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
