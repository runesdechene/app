/** Source unique de vérité du mode démo. Lu depuis le flag de build. */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true'
}
