/**
 * QUOI     — ce qu'on sait d'une contribution sans la base : le libellé de ses statuts, si un fichier est une
 *            vidéo, le texte alternatif que Shopify reçoit, le nom d'un fichier téléchargé.
 * POURQUOI — les mêmes règles que l'ancien Hub (texte alternatif « Pierre mesure 1m83 et porte du M ») ; ici elles
 *            se testent seules, hors de l'écran.
 */
import type { StatutContribution } from '../api/contributions'

export const STATUTS: Record<StatutContribution, string> = { pending: 'À valider', approved: 'Publiée', archived: 'Archivée' }

const VIDEOS = /\.(mp4|mov|webm|avi|mkv|m4v)$/i

/** L'adresse sans sa requête (« ?t=1 ») : ce qui reste est le chemin du fichier. */
const sansRequete = (url: string) => url.split(/[?#]/)[0] ?? url

export function estUneVideo(url: string): boolean {
  return VIDEOS.test(sansRequete(url))
}

/** « Pierre mesure 1m83 et porte du M » : les parties absentes sont omises. */
export function texteAlternatif(nom: string | null, hauteurCm: number | null, taille: string | null): string {
  const prenom = (nom ?? '').trim()
  if (!prenom) return 'Communauté Runes de Chêne'
  const hauteur = hauteurCm !== null && hauteurCm > 0
    ? `${String(Math.floor(hauteurCm / 100))}m${String(Math.round(hauteurCm % 100)).padStart(2, '0')}`
    : ''
  const porte = taille && taille !== 'none' ? taille.trim() : ''
  if (hauteur && porte) return `${prenom} mesure ${hauteur} et porte du ${porte}`
  if (hauteur) return `${prenom} mesure ${hauteur}`
  if (porte) return `${prenom} porte du ${porte}`
  return prenom
}

export const nettoyer = (texte: string) => texte.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim()

/** « Brune K. - @brune - 1.jpg » : le rang commence à 0, l'extension est celle du fichier (webp à défaut). */
export function nomDeFichier(nom: string, instagram: string | null, rang: number, url: string): string {
  const extension = /\.([A-Za-z0-9]+)$/.exec(sansRequete(url).split('/').pop() ?? '')?.[1]?.toLowerCase() ?? 'webp'
  const morceaux = [nettoyer(nom), instagram ? nettoyer(instagram) : '', String(rang + 1)].filter(Boolean)
  return `${morceaux.join(' - ')}.${extension}`
}

/** L'adresse publique avec `?download=` : Supabase la sert alors en pièce jointe, sous ce nom. */
export function adresseDeTelechargement(url: string, nom: string): string {
  try {
    const adresse = new URL(url)
    adresse.searchParams.set('download', nom)
    return adresse.toString()
  } catch {
    return url
  }
}
