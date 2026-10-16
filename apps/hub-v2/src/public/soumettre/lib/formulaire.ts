/**
 * QUOI     — les trois parts du formulaire (les contenus, l'histoire, toi), leurs valeurs de départ,
 *            et les deux verrous : jusqu'où on peut aller, et quand on peut envoyer.
 * POURQUOI — l'étape vient de l'adresse (`?etape=3`), qu'on peut taper à la main : la page ne montre
 *            jamais une étape dont les précédentes ne sont pas remplies.
 */
export const AUCUN_PRODUIT = 'none'
export const TAILLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']
export const ETAPES = ['Tes contenus', 'Les tailles', 'Ton histoire', 'Toi']

export type Contenu = { fichier: File; apercu: string; taille: string | null }

export type Histoire = {
  avis: string
  noteExperience: number
  noteProduits: number
  motEquipe: string
  departement: string
}

export type Toi = { prenom: string; email: string; tailleCm: string; accordMarque: boolean; accordCompte: boolean }

export const HISTOIRE_VIDE: Histoire = { avis: '', noteExperience: 0, noteProduits: 0, motEquipe: '', departement: '' }
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

export function toiComplet(t: Toi): boolean {
  return t.prenom.trim() !== '' && EMAIL.test(t.email.trim()) && t.accordMarque && t.accordCompte
}

/** La taille du modèle, en centimètres, seulement si elle est plausible (100 à 250). */
export function tailleEnCm(saisie: string): number | null {
  const cm = Number.parseInt(saisie, 10)
  return cm >= 100 && cm <= 250 ? cm : null
}
