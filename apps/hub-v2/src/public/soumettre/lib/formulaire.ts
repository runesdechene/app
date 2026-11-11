/**
 * QUOI     — les deux chemins (un avis, des photos), leurs écrans dans l'ordre, les parts du formulaire
 *            (les contenus, l'avis, toi), leurs valeurs de départ, et les verrous : jusqu'où on peut
 *            aller, et quand on peut envoyer.
 * POURQUOI — le choix est l'étape 1 (Uriel, 11/11), puis les deux chemins passent par les mêmes
 *            écrans dans un ordre différent : l'avis d'abord et les photos facultatives, ou les photos
 *            d'abord et l'avis facultatif. Le chemin et l'étape viennent de l'adresse
 *            (`?chemin=avis&etape=3`), qu'on peut taper à la main : la page ne montre jamais un écran
 *            dont les précédents ne sont pas remplis.
 */
export const AUCUN_PRODUIT = 'none'
export const TAILLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']

export type Chemin = 'photos' | 'avis'
export type Ecran = 'avis' | 'photos' | 'tailles' | 'toi'

/** Les écrans de chaque chemin, après le choix ; les tailles ne s'ouvrent que s'il y a des photos. */
const ORDRE: Record<Chemin, Ecran[]> = {
  avis: ['avis', 'photos', 'tailles', 'toi'],
  photos: ['photos', 'tailles', 'avis', 'toi'],
}

/** La frise de chaque chemin ; avant le choix, celle d'un avis. */
export const ETAPES: Record<Chemin, string[]> = {
  avis: ['Ton choix', 'Ton avis', 'Tes photos', 'Toi'],
  photos: ['Ton choix', 'Tes photos', 'Ton avis', 'Toi'],
}

/** Les avis s'affichent par type de vêtement, jamais par motif ; `page` dit où l'avis sera publié. */
export const VETEMENTS = [
  { cle: 'tshirt', nom: 'T-shirt', page: 'la page des T-shirts' },
  { cle: 'sweatshirt', nom: 'Sweatshirt', page: 'la page des sweatshirts' },
  { cle: 'veste_zip', nom: 'Veste Zip', page: 'la page des vestes zip' },
]

export type Contenu = { fichier: File; apercu: string; taille: string | null }

export type Histoire = {
  avis: string
  noteExperience: number
  noteProduits: number
  motEquipe: string
  departement: string
  vetement: string
}

export type Toi = { prenom: string; email: string; tailleCm: string; accordMarque: boolean; accordCompte: boolean }

export const HISTOIRE_VIDE: Histoire = { avis: '', noteExperience: 0, noteProduits: 0, motEquipe: '', departement: '', vetement: '' }
export const TOI_VIDE: Toi = { prenom: '', email: '', tailleCm: '', accordMarque: false, accordCompte: false }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Le chemin de l'adresse ; un lien de mission (`?quete=`) déjà imprimé ouvre les photos ; sinon, le choix. */
export function cheminDe(params: URLSearchParams): Chemin | null {
  const chemin = params.get('chemin')
  if (chemin === 'photos' || chemin === 'avis') return chemin
  return params.has('quete') ? 'photos' : null
}

/** Un avis : un vêtement, et une note ou quelques mots. */
export function avisComplet(h: Histoire): boolean {
  return h.vetement !== '' && (h.noteProduits > 0 || h.noteExperience > 0 || h.avis.trim() !== '')
}

/** Peut-on passer cet écran ? Seul ce que le chemin a choisi est obligatoire. */
function rempli(chemin: Chemin, ecran: Ecran, h: Histoire, contenus: Contenu[]): boolean {
  if (ecran === 'avis') return chemin === 'photos' || avisComplet(h)
  if (ecran === 'photos') return chemin === 'avis' || contenus.length > 0
  if (ecran === 'tailles') return contenus.every((c) => c.taille !== null)
  return false
}

/** Le numéro d'un écran dans l'adresse : le choix vaut 1, puis l'ordre du chemin. */
export function numeroDeLEcran(chemin: Chemin, ecran: Ecran): number {
  return ORDRE[chemin].indexOf(ecran) + 2
}

/** L'écran de l'adresse, ramené au premier qui n'est pas rempli ; sans photo, les tailles n'existent pas. */
export function ecranAffiche(chemin: Chemin, demandee: string | null, h: Histoire, contenus: Contenu[]): Ecran {
  const ordre = ORDRE[chemin].filter((e) => e !== 'tailles' || contenus.length > 0)
  // Le premier écran d'un chemin porte son nom.
  const demande = ORDRE[chemin][Number(demandee) - 2] ?? chemin
  // Les tailles demandées sans photo : on reste aux photos.
  const voulu = ordre.includes(demande) ? demande : 'photos'
  return ordre.find((ecran) => ecran === voulu || !rempli(chemin, ecran, h, contenus)) ?? voulu
}

/** L'écran qui suit (ou précède), en sautant les tailles quand il n'y a pas de photo. */
export function voisin(chemin: Chemin, ecran: Ecran, sens: 1 | -1, contenus: Contenu[]): Ecran {
  const ordre = ORDRE[chemin].filter((e) => e !== 'tailles' || contenus.length > 0)
  return ordre[ordre.indexOf(ecran) + sens] ?? ecran
}

/** L'étape de la frise d'un écran : le choix est la 1 ; les tailles comptent avec les photos. */
export function etapeDeLaFrise(chemin: Chemin, ecran: Ecran): number {
  return ETAPES[chemin].indexOf(ecran === 'avis' ? 'Ton avis' : ecran === 'toi' ? 'Toi' : 'Tes photos') + 1
}

/** Sans photo, pas de compte : le prénom et l'e-mail suffisent. Avec, les deux accords aussi. */
export function toiComplet(t: Toi, avecPhotos: boolean): boolean {
  const identite = t.prenom.trim() !== '' && EMAIL.test(t.email.trim())
  return avecPhotos ? identite && t.accordMarque && t.accordCompte : identite
}

/** La taille du modèle, en centimètres, seulement si elle est plausible (100 à 250). */
export function tailleEnCm(saisie: string): number | null {
  const cm = Number.parseInt(saisie, 10)
  return cm >= 100 && cm <= 250 ? cm : null
}
