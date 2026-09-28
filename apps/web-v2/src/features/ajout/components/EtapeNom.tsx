/**
 * QUOI     — l'étape « Nom » du parcours (ébauche, remplie dans la nuit du 29/09).
 */
import type { ProprietesEtape } from '../lib/brouillon'
import { BoutonSuivant } from './BoutonSuivant'

export function EtapeNom({ onSuivant }: ProprietesEtape) {
  return <BoutonSuivant libelle="Continuer" manque={null} onClick={onSuivant} />
}
