/**
 * Release pipeline pour explore-web :
 *   1. pnpm build (tsc + vite)
 *   2. netlify deploy --prod (avec chemin absolu pour --dir, cf. mémoire
 *      Discipline XO sur abspath obligatoire pour Netlify CLI)
 *   3. sync app_settings.app.latest_version depuis CHANGELOG.md
 *
 * Usage :
 *   cd apps/explore-web && pnpm release
 */

import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APP = resolve(__dirname, '..')
const ROOT = resolve(APP, '..', '..')
const DIST = resolve(APP, 'dist')
const SYNC_SCRIPT = resolve(ROOT, 'scripts', 'sync-app-version.mjs')

// Sur Windows, le path du repo contient des espaces et parenthèses
// ("Runes de Chêne"). spawnSync avec shell:true joint les args avec espace
// simple : tout arg qui contient un espace doit être manuellement quoté
// avant que le shell le voie, sinon il découpe au mauvais endroit.
function quoteIfNeeded(arg) {
  if (typeof arg !== 'string') return arg
  if (/[\s()&]/.test(arg) && !arg.startsWith('"')) return `"${arg}"`
  return arg
}

function step(label, cmd, args, cwd) {
  const safeArgs = args.map(quoteIfNeeded)
  console.log(`\n━━━ ${label} ━━━`)
  console.log(`  $ ${cmd} ${safeArgs.join(' ')}`)
  console.log(`  cwd: ${cwd}\n`)
  const r = spawnSync(cmd, safeArgs, { cwd, stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error(`\n❌ Échec à l'étape "${label}" (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}

step('1/3 — Build', 'pnpm', ['build'], APP)
step('2/3 — Netlify deploy prod', 'netlify', ['deploy', '--prod', '--dir', DIST, '--no-build'], APP)
step('3/3 — Sync app.latest_version en DB', 'node', [SYNC_SCRIPT], ROOT)

console.log('\n✅ Release complète. Les users sur un bundle ancien verront le bandeau au prochain mount.\n')
