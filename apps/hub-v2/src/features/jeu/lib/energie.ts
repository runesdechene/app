/**
 * QUOI     — les réglages de l'Énergie : la jauge et le prix d'une découverte selon la distance. Passage des lignes
 *            d'app_settings aux nombres (et retour), règles de validité, phrase qui dit la règle.
 * POURQUOI — la base relit ces dix clés à chaque calcul (_reglage) ; le cycle y est en secondes, l'écran parle en
 *            minutes. Les règles et leurs messages viennent de l'ancien Hub, plus des bornes hautes (une faute de
 *            frappe ferait déborder value::INT en base) ; la phrase de resume suit le plan.
 */
export type Reglages = {
  maxSansFragment: number
  minutesParPoint: number
  gratuitKm: number
  palier1Km: number
  palier2Km: number
  palier3Km: number
  cout1: number
  cout2: number
  cout3: number
  cout4: number
}

export type LigneDeReglage = { key: string; value: string }

export const CLES: Record<keyof Reglages, string> = {
  maxSansFragment: 'default_max_energy',
  minutesParPoint: 'energy_base_cycle',
  gratuitKm: 'decouverte_gratuite_km',
  palier1Km: 'decouverte_palier_1_km',
  palier2Km: 'decouverte_palier_2_km',
  palier3Km: 'decouverte_palier_3_km',
  cout1: 'decouverte_cout_1',
  cout2: 'decouverte_cout_2',
  cout3: 'decouverte_cout_3',
  cout4: 'decouverte_cout_4',
}

export const DEFAUTS: Reglages = {
  maxSansFragment: 10,
  minutesParPoint: 120,
  gratuitKm: 50,
  palier1Km: 150,
  palier2Km: 500,
  palier3Km: 1000,
  cout1: 1,
  cout2: 2,
  cout3: 3,
  cout4: 4,
}

const CHAMPS = Object.keys(CLES) as (keyof Reglages)[]

// Une clé absente ou illisible reprend sa valeur par défaut.
export function depuisLignes(lignes: LigneDeReglage[]): Reglages {
  const reglages = { ...DEFAUTS }
  for (const champ of CHAMPS) {
    const ligne = lignes.find((l) => l.key === CLES[champ])
    const nombre = ligne === undefined || ligne.value.trim() === '' ? Number.NaN : Number(ligne.value)
    if (Number.isFinite(nombre)) reglages[champ] = champ === 'minutesParPoint' ? nombre / 60 : nombre
  }
  return reglages
}

export function versLignes(r: Reglages): LigneDeReglage[] {
  return CHAMPS.map((champ) => ({
    key: CLES[champ],
    value: String(champ === 'minutesParPoint' ? r[champ] * 60 : r[champ]),
  }))
}

// Une phrase par erreur, ou null si tout va bien.
export function erreurReglages(r: Reglages): string | null {
  if (Object.values(r).some((v) => !Number.isInteger(v) || v < 0)) return 'Chaque valeur doit être un nombre entier positif.'
  if (r.maxSansFragment < 1) return 'La jauge doit compter au moins 1 point.'
  if (r.minutesParPoint < 10) return 'Un point ne peut pas revenir en moins de 10 minutes.'
  if (r.maxSansFragment > 1000) return 'La jauge ne dépasse pas 1000 points.'
  if (r.minutesParPoint > 1440) return 'Un point se recharge en 24 h au plus.'
  if ([r.gratuitKm, r.palier1Km, r.palier2Km, r.palier3Km].some((km) => km > 20000)) return 'Une distance ne dépasse pas 20 000 km.'
  if ([r.cout1, r.cout2, r.cout3, r.cout4].some((cout) => cout > 1000)) return 'Un coût ne dépasse pas 1000 points.'
  if (!(r.gratuitKm < r.palier1Km && r.palier1Km < r.palier2Km && r.palier2Km < r.palier3Km)) {
    return 'Les distances doivent aller croissant : zone gratuite, puis palier 1, 2, 3.'
  }
  if (!(r.cout1 <= r.cout2 && r.cout2 <= r.cout3 && r.cout3 <= r.cout4)) return 'Plus un lieu est loin, plus il coûte : prix 1 ≤ 2 ≤ 3 ≤ au-delà.'
  return null
}

const points = (n: number) => `${String(n)} point${n > 1 ? 's' : ''}`

export function resume(r: Reglages): string {
  return `Gratuit jusqu’à ${String(r.gratuitKm)} km, puis ${points(r.cout1)} jusqu’à ${String(r.palier1Km)} km, `
    + `${points(r.cout2)} jusqu’à ${String(r.palier2Km)} km, ${points(r.cout3)} jusqu’à ${String(r.palier3Km)} km, `
    + `${points(r.cout4)} au-delà. Sans position, un lieu coûte le prix « Au-delà ».`
}
