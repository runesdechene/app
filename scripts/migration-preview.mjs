/**
 * migration-preview.mjs — diff visuel d'une migration avant `db query`.
 *
 * Pour chaque CREATE OR REPLACE FUNCTION dans la migration cible, retrouve
 * la version actuellement définie (dernière occurrence dans migrations
 * précédentes triées par numéro) et affiche un diff côté git + un résumé
 * des valeurs hardcodées qui ont changé (limites, gains, distances, return shapes).
 *
 * Garde-fou contre la classe de bug du 9 avril 2026 où la migration 081 a
 * silencieusement ramené revisit_place_gps à un état pré-V0.5.7 — perdu
 * jusqu'au 28 avril.
 *
 * Usage :
 *   node scripts/migration-preview.mjs supabase/migrations/NNN_*.sql
 *
 * Workflow recommandé :
 *   1. Écrire la migration
 *   2. node scripts/migration-preview.mjs supabase/migrations/NNN_*.sql
 *   3. Lire le diff. Si surprenant → revoir la migration AVANT d'apply.
 *   4. npx supabase db query --linked -f supabase/migrations/NNN_*.sql
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, basename, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', BOLD = '\x1b[1m', RESET = '\x1b[0m'

if (process.argv.length < 3) {
  console.error('Usage: node scripts/migration-preview.mjs <path-to-migration.sql>')
  process.exit(2)
}

const TARGET = process.argv[2]
if (!existsSync(TARGET)) {
  console.error(`File not found: ${TARGET}`)
  process.exit(2)
}

const MIG_DIR = dirname(TARGET)
const TARGET_NAME = basename(TARGET)

function extractFunctions(sql) {
  const out = []
  const re = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:"public"|public)\."?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\(/gi
  let match
  while ((match = re.exec(sql)) !== null) {
    const name = match[1]
    const start = match.index
    const dollarStart = sql.indexOf('$$', start)
    if (dollarStart === -1) continue
    const dollarEnd = sql.indexOf('$$', dollarStart + 2)
    if (dollarEnd === -1) continue
    const semi = sql.indexOf(';', dollarEnd)
    const end = semi === -1 ? dollarEnd + 2 : semi + 1
    out.push({ name, fullText: sql.slice(start, end) })
  }
  return out
}

function findPreviousVersion(name, allFiles, targetName) {
  const targetIdx = allFiles.indexOf(targetName)
  const candidates = allFiles.slice(0, targetIdx === -1 ? allFiles.length : targetIdx)
  for (let i = candidates.length - 1; i >= 0; i--) {
    const path = join(MIG_DIR, candidates[i])
    const sql = readFileSync(path, 'utf8')
    const funcs = extractFunctions(sql)
    const found = funcs.filter(f => f.name === name)
    if (found.length > 0) {
      return { file: candidates[i], fullText: found[found.length - 1].fullText }
    }
  }
  return null
}

function extractNotables(text) {
  const lines = text.split('\n')
  const notable = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (
      /:=\s*[\d.]/.test(trimmed) ||
      />\s*[\d.]/.test(trimmed) ||
      />=\s*[\d.]/.test(trimmed) ||
      /<\s*[\d.]/.test(trimmed) ||
      /<=\s*[\d.]/.test(trimmed) ||
      /=\s*[\d.]+\s*THEN/i.test(trimmed) ||
      /'error',\s*'[^']+'/.test(trimmed) ||
      /jsonb_build_object\(/.test(trimmed) ||
      /json_build_object\(/.test(trimmed) ||
      /^IF\s+/i.test(trimmed) ||
      /^RETURN\s+/i.test(trimmed) ||
      /COALESCE\s*\(\s*\(\s*SELECT\s+value/.test(trimmed)
    ) {
      notable.push(trimmed)
    }
  }
  return notable
}

function notablesDiff(oldNot, newNot) {
  const oldSet = new Set(oldNot)
  const newSet = new Set(newNot)
  const removed = oldNot.filter(l => !newSet.has(l))
  const added = newNot.filter(l => !oldSet.has(l))
  return { removed, added }
}

function gitDiff(oldText, newText) {
  const tmpA = join(tmpdir(), `_preview_old_${process.pid}.sql`)
  const tmpB = join(tmpdir(), `_preview_new_${process.pid}.sql`)
  writeFileSync(tmpA, oldText)
  writeFileSync(tmpB, newText)
  try {
    return execFileSync('git', ['diff', '--no-index', '--no-color', '--unified=2', tmpA, tmpB], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (e) {
    return e.stdout || ''
  }
}

function colorize(diffText) {
  return diffText.split('\n').map(line => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) return CYAN + line + RESET
    if (line.startsWith('@@')) return YELLOW + line + RESET
    if (line.startsWith('+')) return GREEN + line + RESET
    if (line.startsWith('-')) return RED + line + RESET
    return line
  }).join('\n')
}

const allFiles = readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort()
const targetSql = readFileSync(TARGET, 'utf8')
const newFuncs = extractFunctions(targetSql)

if (newFuncs.length === 0) {
  console.log(`${YELLOW}Aucune CREATE OR REPLACE FUNCTION détectée dans ${TARGET_NAME}.${RESET}`)
  console.log('Migration purement DDL/data ? Pas de garde-fou nécessaire.')
  process.exit(0)
}

console.log(`${BOLD}${CYAN}=== Migration preview : ${TARGET_NAME} ===${RESET}`)
console.log(`${newFuncs.length} fonction(s) touchée(s) : ${newFuncs.map(f => f.name).join(', ')}`)
console.log()

let totalChanged = 0
let totalNew = 0

for (const fn of newFuncs) {
  const prev = findPreviousVersion(fn.name, allFiles, TARGET_NAME)
  console.log(`${BOLD}── ${fn.name} ──${RESET}`)

  if (!prev) {
    console.log(`  ${GREEN}✓ NOUVELLE fonction (pas de version antérieure dans migrations).${RESET}`)
    totalNew++
    console.log()
    continue
  }

  console.log(`  Version actuelle : ${prev.file}`)
  const diff = gitDiff(prev.fullText, fn.fullText)
  const diffLines = diff.split('\n').filter(l => (l.startsWith('+') && !l.startsWith('+++')) || (l.startsWith('-') && !l.startsWith('---')))
  if (!diff.trim() || diffLines.length === 0) {
    console.log(`  ${GREEN}✓ Pas de divergence (modulo formatting).${RESET}`)
    console.log()
    continue
  }

  totalChanged++
  console.log(colorize(diff))

  const oldNot = extractNotables(prev.fullText)
  const newNot = extractNotables(fn.fullText)
  const { removed, added } = notablesDiff(oldNot, newNot)
  if (removed.length || added.length) {
    console.log(`  ${BOLD}${YELLOW}⚠ Valeurs / conditions / retours qui ont CHANGÉ :${RESET}`)
    for (const r of removed) console.log(`    ${RED}- ${r}${RESET}`)
    for (const a of added) console.log(`    ${GREEN}+ ${a}${RESET}`)
  }
  console.log()
}

console.log(`${BOLD}=== Récap ===${RESET}`)
console.log(`  Nouvelles fonctions : ${totalNew}`)
console.log(`  Fonctions modifiées : ${totalChanged}`)
if (totalChanged > 0) {
  console.log()
  console.log(`${YELLOW}${BOLD}⚠ Lis le diff ci-dessus AVANT d'apply.${RESET}`)
  console.log(`Si une régression sémantique est détectée → corriger la migration AVANT \`npx supabase db query\`.`)
}
