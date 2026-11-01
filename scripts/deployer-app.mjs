/**
 * Déploie l'appli (apps/web-v2) sur app.runesdechene.com, en une commande : `pnpm deploy:app`.
 *
 * 1. Monte la version mineure de apps/web-v2/package.json (1.38.1 → 1.39.0) et la commite seule.
 * 2. Build, puis déploie depuis apps/web-v2 : la CLI y lit le netlify.toml de l'appli.
 * 3. Annonce la version en base (sync-app-version.mjs) : les téléphones proposent la mise à jour.
 *
 * Les vérifications en ligne restent à faire : .claude/rules/deploiement.md.
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APP = resolve(ROOT, 'apps/web-v2')
const PAQUET = resolve(APP, 'package.json')
const SITE = '1b29da09-c7af-44bf-9c31-465bfaae9d74'

function lancer(commande, cwd = ROOT) {
  execSync(commande, { cwd, stdio: 'inherit' })
}

const texte = readFileSync(PAQUET, 'utf-8')
const avant = JSON.parse(texte).version
const [majeure, mineure] = avant.split('.').map(Number)
const version = `${majeure}.${mineure + 1}.0`
writeFileSync(PAQUET, texte.replace(`"version": "${avant}"`, `"version": "${version}"`))
console.log(`Version ${avant} → ${version}`)

// Seul package.json part dans ce commit, même si d'autres fichiers sont en cours.
lancer(`git commit -m "chore(web-v2): ${version}" -- apps/web-v2/package.json`)
lancer('pnpm build', APP)
lancer(`netlify deploy --prod --no-build --dir dist --site=${SITE}`, APP)
lancer('node scripts/sync-app-version.mjs')
