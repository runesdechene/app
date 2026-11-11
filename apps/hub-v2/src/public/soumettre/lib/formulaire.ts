/**
 * QUOI     — les deux chemins (un avis avec photos, un avis seul), les trois parts du formulaire (les
 *            contenus, l'histoire, toi), leurs valeurs de départ, et les verrous : jusqu'où on peut
 *            aller, et quand on peut envoyer.
 * POURQUOI — le chemin et l'étape viennent de l'adresse (`?chemin=avis&etape=2`), qu'on peut taper à
 *            la main : la page ne montre jamais une étape dont les précédentes ne sont pas remplies.
 */
export const AUCUN_PRODUIT = 'none'
export const TAILLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']
export const ETAPES = ['Tes contenus', 'Les tailles', 'Ton histoire', 'Toi']
export const ETAPES_AVIS = ['Ton avis', 'Toi']

export type Chemin = 'photos' | 'avis'

/** Les avis s'affichent par type de vêtement, jamais par motif ; `page` dit où l'avis sera publié. */
export const VETEMENTS = [
  { cle: 'tshirt', nom: 'T-shirt', page: 'la page des T-shirts' },
  { cle: 'sweat', nom: 'Sweat', page: 'la page des sweats' },
  { cle: 'casquette', nom: 'Casquette', page: 'la page des casquettes' },
  { cle: 'autre', nom: 'Autre', page: 'la boutique' },
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

/** La dernière étape ouverte : 1 sans fichier, 2 tant qu'un fichier n'a pas sa taille, sinon 4. */
export function etapeAtteignable(contenus: Contenu[]): number {
  if (contenus.length === 0) return 1
  return contenus.every((c) => c.taille !== null) ? 4 : 2
}

/** L'étape de l'adresse, ramenée à ce qui est ouvert. */
export function etapeAffichee(demandee: string | null, contenus: Contenu[]): number {
  const n = Number(demandee)
  const valide = Number.isInteger(n) && n >= 1 && n <= ETAPES.length ? n : 1
  return Math.min(valide, etapeAtteignable(contenus))
}

/** Le chemin de l'adresse ; un lien de mission (`?quete=`) déjà imprimé ouvre les photos ; sinon, le choix. */
export function cheminDe(params: URLSearchParams): Chemin | null {
  const chemin = params.get('chemin')
  if (chemin === 'photos' || chemin === 'avis') return chemin
  return params.has('quete') ? 'photos' : null
}

/** Un avis seul : un vêtement, et une note ou quelques mots. */
export function avisComplet(h: Histoire): boolean {
  return h.vetement !== '' && (h.noteProduits > 0 || h.noteExperience > 0 || h.avis.trim() !== '')
}

/** L'étape de l'avis seul : « Toi » (2) seulement quand l'avis est complet. */
export function etapeAvisAffichee(demandee: string | null, h: Histoire): number {
  return demandee === '2' && avisComplet(h) ? 2 : 1
}

/** Un avis seul ne crée pas de compte : ni accord de compte, ni accord de diffusion des photos. */
export function toiComplet(t: Toi, chemin: Chemin): boolean {
  const identite = t.prenom.trim() !== '' && EMAIL.test(t.email.trim())
  return chemin === 'avis' ? identite : identite && t.accordMarque && t.accordCompte
}

/** La taille du modèle, en centimètres, seulement si elle est plausible (100 à 250). */
export function tailleEnCm(saisie: string): number | null {
  const cm = Number.parseInt(saisie, 10)
  return cm >= 100 && cm <= 250 ? cm : null
}
