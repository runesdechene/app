/**
 * QUOI     — la version de la V2 : son nom (Pythéas, pour toute la 1.x) et son numéro ; et la
 *            comparaison avec la version annoncée en base (`app_settings`, clé explore.version).
 * POURQUOI — Uriel, 01/10 : voir en bas de la barre que le dernier déploiement est bien arrivé.
 *            Le numéro vient de `package.json` (Vite le pose au build, `__VERSION__`) : on le
 *            monte à chaque déploiement — voir `.claude/rules/deploiement.md`.
 */
export const NUMERO = __VERSION__
export const VERSION = `Pythéas ${NUMERO}`

// « 1.10.0 » est plus récente que « 1.9.0 » : chiffre par chiffre. Une valeur illisible ne
// compte pas — elle n'oblige jamais à recharger.
export function estPlusRecente(annoncee: string, actuelle: string): boolean {
  const lire = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : null)
  const a = lire(annoncee)
  const b = lire(actuelle)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}
