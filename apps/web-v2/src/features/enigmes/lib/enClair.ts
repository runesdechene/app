/**
 * QUOI     — ce que dit la page « Les énigmes » : « énigme(s) résolue(s) », l'encart de ce qui reste
 *            à percer, la date d'une bonne réponse, et le lien qui vole sur la zone d'une culture.
 * POURQUOI — maquettes 478:452 et 478:526 (Uriel, 07/10 : « un joli cadre qui explique bien le truc »).
 */
export function resoluesEnClair(n: number): string {
  return n > 1 ? 'énigmes résolues' : 'énigme résolue'
}

export function encartEnClair(restantes: number, culture: string, zone: string | null) {
  if (restantes <= 0) return { titre: 'Tout est percé', phrase: 'De nouvelles énigmes viendront.' }
  return {
    titre: restantes === 1 ? 'Encore une énigme à percer' : `Encore ${String(restantes)} énigmes à percer`,
    phrase: `Chaque matin, une énigme de ${culture} s’éveille ${zone ?? 'quelque part dans sa zone'}. Zoome sur la carte : les sceaux « ? » t’attendent.`,
  }
}

const JOUR_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const MOIS_ANNEE = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

function memeJour(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

export function quandEnClair(iso: string, maintenant = new Date()): string {
  const le = new Date(iso)
  const hier = new Date(maintenant)
  hier.setDate(hier.getDate() - 1)
  if (memeJour(le, maintenant)) return 'aujourd’hui'
  if (memeJour(le, hier)) return 'hier'
  if (le.getFullYear() === maintenant.getFullYear()) return JOUR_MOIS.format(le)
  return MOIS_ANNEE.format(le)
}

// `/carte?zone=lat,lng` : la carte y vole (lu par `features/carte/lib/zone.ts`).
export function lienVersLaCarte(centre: { lat: number; lng: number }): string {
  return `/carte?zone=${String(centre.lat)},${String(centre.lng)}`
}
