/**
 * QUOI     — rapatrie dans le stockage Supabase les fichiers encore servis par Firebase (le
 *            stockage de la V1, chez Google) : chaque fichier est copié une fois dans
 *            place-images/rapatrie/, puis son adresse est remplacée partout où la base la cite.
 * POURQUOI — audit RGPD du 11/10/2026 : 2 562 photos de lieux et 481 photos de profil faisaient
 *            contacter Google par chaque visiteur. La politique de confidentialité le dit ; ce
 *            script le règle, et la ligne « Google (Firebase) » pourra en partir. Deux formes
 *            d'adresse : firebasestorage.googleapis.com et storage.googleapis.com/wanderers-… (la
 *            seconde, oubliée au premier passage : 238 photos de lieux, 17 de profil, rattrapées le
 *            soir même).
 * ATTENTION — `--essai` compte sans rien changer. Sans lui, il écrit : la correspondance
 *            ancienne → nouvelle adresse est gardée dans scripts/rapatriement-firebase.json (le
 *            retour arrière). Rejouable : un fichier déjà copié n'est pas recopié, une ligne déjà
 *            réécrite n'a plus d'adresse Firebase. Les fichiers Firebase ne sont pas effacés.
 * Usage    — node scripts/rapatrier-firebase.mjs --essai   puis   node scripts/rapatrier-firebase.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf-8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_BASE = env.VITE_SUPABASE_URL
const CLE = env.SUPABASE_SERVICE_ROLE_KEY
const ESSAI = process.argv.includes('--essai')
const SEAU = 'place-images'
const JOURNAL = new URL('./rapatriement-firebase.json', import.meta.url)
const FIREBASE = /https:\/\/(?:firebasestorage|storage)\.googleapis\.com\/[^"\s\\]+/g
const TRACE = 'googleapis.com'

// Les colonnes qui citent Firebase (relevé du 11/10) : table, clé, colonne.
// Une colonne JSON ne se filtre pas avec `like` par PostgREST : on la lit en entier, on trie ici.
const COLONNES = [
  ['places', 'id', 'images', 'json'],
  ['place_contributions', 'id', 'images', 'json'],
  ['users', 'id', 'avatar_url', 'texte'],
  ['image_media', 'id', 'variants', 'json'],
  ['notifications', 'id', 'data', 'json'],
  ['activity_log', 'id', 'data', 'json'],
]

const entetes = { apikey: CLE, Authorization: `Bearer ${CLE}` }

async function lignes(table, cle, colonne, sorte) {
  const filtre = sorte === 'texte' ? `&${colonne}=like.*${TRACE}*` : ''
  const toutes = []
  for (let debut = 0; ; debut += 1000) {
    const r = await fetch(
      `${URL_BASE}/rest/v1/${table}?select=${cle},${colonne}${filtre}&order=${cle}`,
      { headers: { ...entetes, Range: `${debut}-${debut + 999}` } },
    )
    if (!r.ok) throw new Error(`${table} : ${r.status} ${await r.text()}`)
    const page = await r.json()
    toutes.push(...page.filter((l) => JSON.stringify(l[colonne] ?? '').includes(TRACE)))
    if (page.length < 1000) return toutes
  }
}

function nouveauChemin(ancienne, type) {
  const nom = decodeURIComponent(new URL(ancienne).pathname.split('/').at(-1) ?? 'fichier')
  const extension = (nom.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? type.split('/')[1] ?? 'bin').toLowerCase()
  const empreinte = createHash('sha1').update(ancienne.split('?')[0]).digest('hex').slice(0, 20)
  return `rapatrie/${empreinte}.${extension}`
}

async function copier(ancienne) {
  const source = await fetch(ancienne)
  if (!source.ok) return null // un fichier déjà disparu chez Firebase : on laisse l'adresse
  const type = source.headers.get('content-type') ?? 'application/octet-stream'
  const chemin = nouveauChemin(ancienne, type)
  const envoi = await fetch(`${URL_BASE}/storage/v1/object/${SEAU}/${chemin}`, {
    method: 'POST',
    headers: { ...entetes, 'Content-Type': type, 'x-upsert': 'true' },
    body: Buffer.from(await source.arrayBuffer()),
  })
  if (!envoi.ok) throw new Error(`envoi ${chemin} : ${envoi.status} ${await envoi.text()}`)
  return `${URL_BASE}/storage/v1/object/public/${SEAU}/${chemin}`
}

const correspondance = existsSync(JOURNAL) ? JSON.parse(readFileSync(JOURNAL, 'utf-8')) : {}
const aReecrire = []
const adresses = new Set()
for (const [table, cle, colonne, sorte] of COLONNES) {
  const trouvees = await lignes(table, cle, colonne, sorte)
  for (const l of trouvees) {
    const texte = typeof l[colonne] === 'string' ? l[colonne] : JSON.stringify(l[colonne])
    for (const a of texte.match(FIREBASE) ?? []) adresses.add(a)
    aReecrire.push({ table, cle, colonne, id: l[cle], valeur: l[colonne] })
  }
  console.log(`${table}.${colonne} : ${trouvees.length} lignes`)
}
console.log(`${adresses.size} fichiers Firebase distincts, ${aReecrire.length} lignes à réécrire`)
if (ESSAI) process.exit(0)

let copies = 0
let disparus = 0
for (const a of adresses) {
  if (correspondance[a]) continue
  const nouvelle = await copier(a)
  if (nouvelle) {
    correspondance[a] = nouvelle
    copies += 1
  } else disparus += 1
  if ((copies + disparus) % 100 === 0) {
    writeFileSync(JOURNAL, JSON.stringify(correspondance, null, 1))
    console.log(`  ${copies} copiés, ${disparus} introuvables`)
  }
}
writeFileSync(JOURNAL, JSON.stringify(correspondance, null, 1))
console.log(`Fichiers : ${copies} copiés, ${disparus} introuvables chez Firebase`)

let reecrites = 0
for (const l of aReecrire) {
  const brut = typeof l.valeur === 'string' ? l.valeur : JSON.stringify(l.valeur)
  const neuf = brut.replace(FIREBASE, (a) => correspondance[a] ?? a)
  if (neuf === brut) continue
  const valeur = typeof l.valeur === 'string' ? neuf : JSON.parse(neuf)
  const r = await fetch(`${URL_BASE}/rest/v1/${l.table}?${l.cle}=eq.${encodeURIComponent(l.id)}`, {
    method: 'PATCH',
    headers: { ...entetes, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ [l.colonne]: valeur }),
  })
  if (!r.ok) throw new Error(`${l.table} ${l.id} : ${r.status} ${await r.text()}`)
  reecrites += 1
}
console.log(`Lignes réécrites : ${reecrites}`)
