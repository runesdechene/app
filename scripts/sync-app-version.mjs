/**
 * Sync la version courante du bundle PWA dans la DB.
 *
 * Lit le premier "# X.Y.Z" du CHANGELOG.md de explore-web, l'upserte dans
 * app_settings (key = 'app.latest_version'). Le frontend compare cette
 * valeur à la version locale du bundle pour afficher le bandeau "Mise à
 * jour disponible" aux users qui tournent sur un bundle plus ancien.
 *
 * Usage : node scripts/sync-app-version.mjs
 *
 * Requiert dans .env (racine monorepo) :
 *   - VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * À enchaîner après chaque netlify deploy de explore-web (cf. script
 * "deploy" du package.json apps/explore-web).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ─── Charge .env (racine monorepo) si pas déjà dans process.env ──────────
const envPath = resolve(ROOT, '.env')
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf-8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.')
  console.error('   Vérifie le .env à la racine du monorepo.')
  process.exit(1)
}

// ─── Lit la version depuis CHANGELOG.md ──────────────────────────────────
const changelogPath = resolve(ROOT, 'apps/explore-web/CHANGELOG.md')
if (!existsSync(changelogPath)) {
  console.error(`❌ CHANGELOG.md introuvable : ${changelogPath}`)
  process.exit(1)
}

const changelog = readFileSync(changelogPath, 'utf-8')
const versionLine = changelog.split(/\r?\n/).find((l) => l.startsWith('# '))
const version = versionLine?.slice(2).trim()

if (!version) {
  console.error('❌ Aucun "# X.Y.Z" trouvé en tête du CHANGELOG.md.')
  process.exit(1)
}

// ─── Upsert app_settings.app.latest_version ──────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { error } = await supabase
  .from('app_settings')
  .upsert({ key: 'app.latest_version', value: version }, { onConflict: 'key' })

if (error) {
  console.error('❌ Erreur Supabase :', error.message)
  process.exit(1)
}

console.log(`✅ app_settings.app.latest_version = "${version}"`)
console.log(`   Les users sur un bundle ancien verront désormais le bandeau de mise à jour.`)
