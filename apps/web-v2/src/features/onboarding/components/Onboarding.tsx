/**
 * QUOI     — /bienvenue/<étape> : les six écrans d'entrée, un par adresse.
 * POURQUOI — l'onboarding vit AVANT la garde d'accès : on y arrive sans compte, depuis la vitrine
 *            (/bienvenue). Le retour est celui du navigateur ; une étape inconnue ramène à la
 *            vitrine.
 */
import { Navigate, useParams } from 'react-router'
import { Bienvenue } from './Bienvenue'
import { Charte } from './Charte'
import { Code } from './Code'
import { Email } from './Email'
import { Nom } from './Nom'
import { Preambule } from './Preambule'

const ECRANS = {
  preambule: Preambule,
  charte: Charte,
  email: Email,
  code: Code,
  nom: Nom,
  fin: Bienvenue,
}

function estEtape(etape: string): etape is keyof typeof ECRANS {
  return etape in ECRANS
}

export function Onboarding() {
  const { etape = '' } = useParams()
  if (!estEtape(etape)) return <Navigate to="/bienvenue" replace />
  const Ecran = ECRANS[etape]
  return <Ecran />
}
