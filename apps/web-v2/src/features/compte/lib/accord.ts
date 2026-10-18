/**
 * QUOI     — les mots du profil accordés au genre choisi : « Explorateur » / « Exploratrice »,
 *            et la ligne « Noble Explorateur des Alpes-Maritimes ».
 * POURQUOI — la base renvoie des données (le département avec son article, le genre), jamais une
 *            phrase : un mot se change ici, sans migration (Uriel, 19/10/2026).
 */
import type { Attache } from '../api/lireProfil'

export function explorateur(genre: 'm' | 'f'): string {
  return genre === 'f' ? 'Exploratrice' : 'Explorateur'
}

export function phraseAttache(attache: Attache, genre: 'm' | 'f'): string {
  const noble = `Noble ${explorateur(genre)}`
  return attache.estUnPays ? `${noble} · ${attache.nom}` : `${noble} ${attache.nom}`
}
