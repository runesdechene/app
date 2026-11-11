/**
 * QUOI     — pose à côté de chaque photo du bucket `community-photos` sa vignette `<nom>_thumb.webp`
 *            (400 px, WebP 82), comme les photos de lieux. Les vidéos et les vignettes déjà là sont sautées.
 * POURQUOI — la vue « Photos » du Hub décodait 134 photos en 1920 px pour des cases de 180 px : 1 à 4 s
 *            par clic de filtre (mesure du 11/11/2026). Les nouvelles photos ont leur vignette à l'envoi.
 *
 * Usage : node --env-file=.env scripts/vignettes-photos-communaute.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const CLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SUPABASE || !CLE) throw new Error('VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY : charger le .env')

const supabase = createClient(URL_SUPABASE, CLE)
const BUCKET = 'community-photos'
const ESSAI = process.argv.includes('--dry-run')
const IMAGE = /\.(webp|jpe?g|png)$/i
const vignetteDe = (chemin) => chemin.replace(IMAGE, '_thumb.webp')

/** Tous les fichiers sous un dossier, sous-dossiers compris (l'API liste un niveau à la fois). */
async function lister(dossier) {
  const { data, error } = await supabase.storage.from(BUCKET).list(dossier, { limit: 1000 })
  if (error) throw error
  const fichiers = []
  for (const f of data) {
    const chemin = dossier ? `${dossier}/${f.name}` : f.name
    if (f.id === null) fichiers.push(...(await lister(chemin)))
    else fichiers.push(chemin)
  }
  return fichiers
}

const tous = await lister('')
const deja = new Set(tous.filter((c) => c.endsWith('_thumb.webp')))
const aFaire = tous.filter((c) => IMAGE.test(c) && !c.endsWith('_thumb.webp') && !deja.has(vignetteDe(c)))
console.log(`${tous.length} fichiers, ${aFaire.length} vignettes à poser${ESSAI ? ' (essai)' : ''}`)

let faites = 0
for (const chemin of aFaire) {
  if (ESSAI) continue
  const { data, error } = await supabase.storage.from(BUCKET).download(chemin)
  if (error) { console.error(`✗ ${chemin} : ${error.message}`); continue }
  const vignette = await sharp(Buffer.from(await data.arrayBuffer())).rotate()
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
  const envoi = await supabase.storage.from(BUCKET)
    .upload(vignetteDe(chemin), vignette, { contentType: 'image/webp', upsert: false })
  if (envoi.error) { console.error(`✗ ${chemin} : ${envoi.error.message}`); continue }
  faites += 1
}
console.log(`${faites} vignettes posées`)
