export interface SearchableLike {
  id: string
  title: string
  address: string
}

/** NFD + suppression diacritiques + minuscules + trim. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Match sous-chaîne accent-insensible sur titre puis adresse. Ordre d'entrée préservé. */
export function searchPlaces<T extends SearchableLike>(items: T[], query: string, limit = 20): T[] {
  const q = normalize(query)
  if (!q) return []
  const out: T[] = []
  for (const it of items) {
    if (normalize(it.title).includes(q) || normalize(it.address).includes(q)) {
      out.push(it)
      if (out.length >= limit) break
    }
  }
  return out
}
