/**
 * Déploie le Hub (apps/hub-v2) sur hub.runesdechene.com, en une commande : `pnpm deploy:hub`.
 *
 * Build, puis déploie depuis apps/hub-v2, fonctions comprises (`--no-build` ne les empaquette pas
 * d'elle-même). Chemins absolus : la CLI résout un chemin relatif depuis la racine du dépôt, où
 * `dist` n'existe pas (01/11/2026). Le site par son identifiant : son nom répond « Not Found ».
 *
 * Les vérifications en ligne restent à faire : .claude/rules/deploiement.md.
 */

import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HUB = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/hub-v2')
const SITE = '5d04dcdd-6374-4e8b-a0f4-fcef64a707f3'

function lancer(commande) {
  execSync(commande, { cwd: HUB, stdio: 'inherit' })
}

lancer('pnpm build')
lancer(
  `netlify deploy --prod --no-build --dir="${resolve(HUB, 'dist')}" --functions="${resolve(HUB, 'netlify/functions')}" --site=${SITE}`,
)
