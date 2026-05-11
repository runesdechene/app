import { usePlayerStore } from '../stores/playerStore'

/**
 * Énergie pour affichage HUD (EnergyIndicator, StatsBar, EnergyInfoModal).
 *
 * Retourne la VRAIE valeur store (synchronisée serveur, NUMERIC(6,1)).
 * Pas d'interpolation client entre 2 ticks — donc affichage stable jusqu'au
 * prochain tick serveur (toutes les 2h sur cycle base 7200s), puis saute.
 *
 * Le nom historique du hook ("fractional") est trompeur : V0.8.6 et avant,
 * on calculait energy + fractionOfTick pour simuler une progression continue.
 * Cette illusion désync l'affichage de la vraie energy dépensable (bug
 * 1.9/1.5 + ressenti d'incohérence StatBar 8.8 vs panel 8.5). Fix V0.8.9 :
 * partout = vraie valeur, regen reste informative via le badge +X/h.
 */
export function useFractionalEnergy(): { energy: number; maxEnergy: number; ratePerHour: number } {
  const energy = usePlayerStore((s) => s.energy)
  const maxEnergy = usePlayerStore((s) => s.maxEnergy)
  const cycleSeconds = usePlayerStore((s) => s.energyCycle)

  const ratePerHour = cycleSeconds > 0 ? 3600 / cycleSeconds : 0

  return { energy, maxEnergy, ratePerHour }
}

/** Format affichage : 1 décimale, plafonné à max. */
export function formatEnergy(n: number, max: number): string {
  if (n >= max) return max.toFixed(1)
  return n.toFixed(1)
}
