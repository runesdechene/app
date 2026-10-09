/**
 * QUOI     — dire un endroit en mots (« Près de Colomars », « Alpes-Maritimes ») et chercher une
 *            adresse, avec Nominatim (OpenStreetMap), le géocodeur de la V1.
 * POURQUOI — l'étape « Où » ne montre jamais de coordonnées (maquette 288:178) : le village le
 *            plus proche dit mieux où l'on est. L'adresse gardée pour la fiche est la rue et la
 *            commune, pas l'empilement du géocodeur.
 * ATTENTION — Nominatim demande de la retenue : une question à la fois, après que la carte s'est
 *            posée (le composant attend), jamais à chaque image du glissé.
 */
import type { Point } from '@/shared/lib/distance'
import { objet, type Objet } from '@/shared/lib/lire'

const NOMINATIM = 'https://nominatim.openstreetmap.org'

export type Endroit = { titre: string; detail: string; adresse: string }
export type Resultat = { nom: string; contexte: string; point: Point }

// Nominatim vient de l'extérieur : une réponse irrégulière donne « rien », jamais une erreur.
function enObjet(v: unknown): Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? objet(v) : {}
}

function texte(o: Objet, cle: string): string | undefined {
  const v = o[cle]
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
}

export function lireEndroit(json: unknown): Endroit {
  const a = enObjet(enObjet(json).address)
  const commune =
    texte(a, 'village') ??
    texte(a, 'town') ??
    texte(a, 'city') ??
    texte(a, 'municipality') ??
    texte(a, 'hamlet')
  const region = texte(a, 'county') ?? texte(a, 'state') ?? ''
  if (commune) {
    return {
      titre: `Près de ${commune}`,
      detail: region,
      adresse: [texte(a, 'road'), commune].filter(Boolean).join(', '),
    }
  }
  if (region) return { titre: region, detail: '', adresse: '' }
  return { titre: 'Un endroit sans nom', detail: '', adresse: '' }
}

export function lireResultats(json: unknown): Resultat[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((v: unknown) => {
    const r = enObjet(v)
    const latitude = Number(texte(r, 'lat'))
    const longitude = Number(texte(r, 'lon'))
    const [premier = '', ...reste] = (texte(r, 'display_name') ?? '')
      .split(',')
      .map((m) => m.trim())
    const nom = texte(r, 'name') ?? premier
    if (!nom || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return []
    const contexte = reste.filter((m) => m.toLowerCase() !== 'france' && !/^\d{4,5}$/.test(m))
    return [{ nom, contexte: contexte.slice(0, 2).join(', '), point: { latitude, longitude } }]
  })
}

export async function endroitDe(ici: Point, signal?: AbortSignal): Promise<Endroit> {
  const url = `${NOMINATIM}/reverse?format=jsonv2&zoom=16&accept-language=fr&lat=${String(ici.latitude)}&lon=${String(ici.longitude)}`
  const reponse = await fetch(url, signal ? { signal } : {})
  if (!reponse.ok) throw new Error('géocodeur indisponible')
  return lireEndroit(await reponse.json())
}

export async function chercherEndroits(texte: string, signal?: AbortSignal): Promise<Resultat[]> {
  const url = `${NOMINATIM}/search?format=jsonv2&limit=5&accept-language=fr&q=${encodeURIComponent(texte)}`
  const reponse = await fetch(url, signal ? { signal } : {})
  if (!reponse.ok) throw new Error('géocodeur indisponible')
  return lireResultats(await reponse.json())
}
