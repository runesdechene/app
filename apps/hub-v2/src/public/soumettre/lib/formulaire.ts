/**
 * QUOI     — les trois parts du formulaire (l'avis, les photos, toi), leurs valeurs de départ, et les
 *            verrous : jusqu'où on peut aller, et quand on peut envoyer.
 * POURQUOI — un seul parcours (Uriel, 11/11) : l'avis d'abord, les photos ensuite et facultatives, pour
 *            qu'on puisse en ajouter une après avoir écrit. L'étape vient de l'adresse (`?etape=2`),
 *            qu'on peut taper à la main : la page ne montre jamais une étape dont les précédentes ne
 *            sont pas remplies. Quatre écrans, trois étapes dans la frise : les tailles font partie
 *            des photos.
 */
export const AUCUN_PRODUIT = 'none'
export const TAILLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']
export const ETAPES = ['Ton avis', 'Tes photos', 'Toi']

/** Les quatre écrans, dans l'ordre ; les tailles comptent dans l'étape des photos. */
export const ECRANS = { avis: 1, photos: 2, tailles: 3, toi: 4 } as const

/** L'étape de la frise qui correspond à un écran. */
export function etapeDeLaFrise(ecran: number): number {
  return ecran === ECRANS.toi ? 3 : Math.min(ecran, 2)
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

/** Un avis : un vêtement, et une note ou quelques mots. */
export function avisComplet(h: Histoire): boolean {
  return h.vetement !== '' && (h.noteProduits > 0 || h.noteExperience > 0 || h.avis.trim() !== '')
}

/** L'écran de l'adresse, ramené à ce qui est ouvert ; sans photo, les tailles n'existent pas. */
export function etapeAffichee(demandee: string | null, h: Histoire, contenus: Contenu[]): number {
  const n = Number(demandee)
  const voulu = Number.isInteger(n) && n >= ECRANS.avis && n <= ECRANS.toi ? n : ECRANS.avis
  if (!avisComplet(h)) return ECRANS.avis
  if (contenus.length === 0) return voulu === ECRANS.tailles ? ECRANS.photos : voulu
  if (voulu === ECRANS.toi && contenus.some((c) => c.taille === null)) return ECRANS.tailles
  return voulu
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
