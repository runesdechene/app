/**
 * QUOI     — la version de la V2 : son nom (Pythéas, pour toute la 1.x) et son numéro.
 * POURQUOI — Uriel, 01/10 : voir en bas de la barre que le dernier déploiement est bien arrivé.
 *            Le numéro vient de `package.json` (Vite le pose au build, `__VERSION__`) : on le
 *            monte à chaque déploiement — voir `.claude/rules/deploiement.md`.
 */
export const VERSION = `Pythéas ${__VERSION__}`
