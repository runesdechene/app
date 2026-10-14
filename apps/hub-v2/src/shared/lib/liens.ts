/**
 * QUOI     — les adresses de l'appli Explore que le Hub ouvre depuis ses fiches.
 * POURQUOI — l'adresse de base est écrite une seule fois.
 */
const APPLI = 'https://app.runesdechene.com'

export function ficheDansLAppli(lieuId: string): string {
  return `${APPLI}/carte/lieu/${lieuId}`
}
