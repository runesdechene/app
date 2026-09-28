/**
 * QUOI     — /bienvenue/<étape> : les sept écrans d'entrée, un par adresse.
 * POURQUOI — l'onboarding vit AVANT la garde d'accès : on y arrive sans compte. Le retour est
 *            celui du navigateur ; une étape inconnue ramène au début.
 */
import { useParams } from 'react-router'
import { Bienvenue } from './Bienvenue'
import { Charte } from './Charte'
import { Code } from './Code'
import { EcranAccueil } from './EcranAccueil'
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
  const Ecran = estEtape(etape) ? ECRANS[etape] : EcranAccueil
  return <Ecran />
}
