/**
 * Annonce en base la version d'Explore qui vient d'être déployée.
 *
 * Lit `version` dans apps/web-v2/package.json et l'écrit dans app_settings
 * (key = 'explore.version'). L'appli compare cette valeur à la sienne : plus
 * ancienne, elle affiche « Une nouvelle version d'Explore est arrivée » et
 * force la mise à jour (apps/web-v2/src/app/miseAJour.ts). Depuis la bascule
 * du 07/10/2026 ; avant, la V1 lisait app.latest_version dans son CHANGELOG.
 *
 * Usage : node scripts/sync-app-version.mjs
 *
 * Requiert dans .env (racine monorepo) :
 *   - VITE_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * À lancer après chaque déploiement d'Explore (.claude/rules/deploiement.md).
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

// ─── Lit la version d'Explore ────────────────────────────────────────────
const paquet = resolve(ROOT, 'apps/web-v2/package.json')
const { version } = JSON.parse(readFileSync(paquet, 'utf-8'))

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error(`❌ Version illisible dans ${paquet} : ${version}`)
  process.exit(1)
}

// ─── Upsert app_settings.explore.version ─────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { error } = await supabase
  .from('app_settings')
  .upsert({ key: 'explore.version', value: version }, { onConflict: 'key' })

if (error) {
  console.error('❌ Erreur Supabase :', error.message)
  process.exit(1)
}

console.log(`✅ app_settings.explore.version = "${version}"`)
console.log(`   Les Explorateurs sur une version plus ancienne verront la fenêtre de mise à jour.`)
