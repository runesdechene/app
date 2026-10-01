// Les réglages de l'énergie (migration 399) : la jauge et le prix d'une découverte selon la
// distance. Lus et écrits dans app_settings ; la base les relit à chaque calcul.

export type ReglagesEnergie = {
  maxSansFragment: number
  minutesParPoint: number
  gratuitKm: number
  palier1Km: number
  palier2Km: number
  cout1: number
  cout2: number
  cout3: number
}

// Chaque réglage et sa clé dans app_settings (le cycle y est en secondes).
export const CLES: Record<keyof ReglagesEnergie, string> = {
  maxSansFragment: 'default_max_energy',
  minutesParPoint: 'energy_base_cycle',
  gratuitKm: 'decouverte_gratuite_km',
  palier1Km: 'decouverte_palier_1_km',
  palier2Km: 'decouverte_palier_2_km',
  cout1: 'decouverte_cout_1',
  cout2: 'decouverte_cout_2',
  cout3: 'decouverte_cout_3',
}

export const DEFAUTS: ReglagesEnergie = {
  maxSansFragment: 10,
  minutesParPoint: 60,
  gratuitKm: 100,
  palier1Km: 500,
  palier2Km: 1500,
  cout1: 1,
  cout2: 2,
  cout3: 3,
}

// Une phrase par erreur, ou null si tout va bien.
export function erreurReglages(r: ReglagesEnergie): string | null {
  if (Object.values(r).some(v => !Number.isInteger(v) || v < 0)) return 'Chaque valeur doit être un nombre entier positif.'
  if (r.maxSansFragment < 1) return 'La jauge doit compter au moins 1 point.'
  if (r.minutesParPoint < 10) return 'Un point ne peut pas revenir en moins de 10 minutes.'
  if (!(r.gratuitKm < r.palier1Km && r.palier1Km < r.palier2Km)) {
    return 'Les distances doivent aller croissant : zone gratuite, puis palier 1, puis palier 2.'
  }
  if (!(r.cout1 <= r.cout2 && r.cout2 <= r.cout3)) return 'Plus un lieu est loin, plus il coûte : prix 1 ≤ prix 2 ≤ au-delà.'
  return null
}

// Ce que vit le joueur avec ces réglages, en une phrase.
export function resume(r: ReglagesEnergie): string {
  const pts = (n: number) => `${n} point${n > 1 ? 's' : ''}`
  return `Un joueur sans Fragment a ${pts(r.maxSansFragment)}, +1 par Fragment. `
    + `Un point revient toutes les ${r.minutesParPoint} min. `
    + `Découvrir est gratuit à moins de ${r.gratuitKm} km, puis coûte ${pts(r.cout1)} jusqu'à ${r.palier1Km} km, `
    + `${pts(r.cout2)} jusqu'à ${r.palier2Km} km, ${pts(r.cout3)} au-delà.`
}
