import { usePlayerStore } from '../stores/playerStore'

/**
 * Énergie fractionnaire calculée localement pour donner l'illusion d'une
 * progression continue entre 2 ticks serveur. Source unique partagée
 * entre EnergyIndicator (HUD carte desktop) et StatsBar (home/carte mobile)
 * pour éviter les écarts visuels (ex. 2.5 vs 3.1 sur le même user).
 *
 * La valeur se rafraîchit chaque seconde via useResourceTimers qui
 * décrémente `nextPointIn` dans le store (déclenche re-render).
 */
export function useFractionalEnergy(): { energy: number; maxEnergy: number; ratePerHour: number } {
  const energy = usePlayerStore((s) => s.energy)
  const maxEnergy = usePlayerStore((s) => s.maxEnergy)
  const cycleSeconds = usePlayerStore((s) => s.energyCycle)
  const nextPointIn = usePlayerStore((s) => s.nextPointIn)

  const isFull = energy >= maxEnergy
  const elapsedInTick = cycleSeconds - nextPointIn
  const fractionOfTick = cycleSeconds > 0 ? elapsedInTick / cycleSeconds : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick, maxEnergy)

  const ratePerHour = cycleSeconds > 0 ? 3600 / cycleSeconds : 0

  return { energy: fractionalEnergy, maxEnergy, ratePerHour }
}

/** Format affichage : floor à 1 décimale. */
export function formatEnergy(n: number, max: number): string {
  if (n >= max) return max.toFixed(1)
  const rounded = Math.floor(n * 10) / 10
  return rounded.toFixed(1)
}
