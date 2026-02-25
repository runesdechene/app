/**
 * Migration des images de lieux :
 * 1. Télécharge depuis l'ancien hébergement (S3 gdv-assets)
 * 2. Compresse en WebP (1920px full + 400px thumb)
 * 3. Upload vers Supabase Storage (bucket place-images)
 * 4. Met à jour le JSONB images avec les nouvelles URLs
 *
 * Usage : node scripts/migrate-images.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

// ─── Config ───────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ukpapqssgsxirsgmcvof.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant. Charge le .env ou passe-le en variable.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const BUCKET = 'place-images'
const FULL_MAX = 1920
const THUMB_MAX = 400
const WEBP_QUALITY = 82

// ─── Helpers ──────────────────────────────────────────────

function isSupabaseUrl(url) {
  return url.includes('supabase.co/storage/')
}

async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function resizeToWebp(buffer, maxDim) {
  const img = sharp(buffer)
  const meta = await img.metadata()
  const w = meta.width || 0
  const h = meta.height || 0

  const opts = {}
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      opts.width = maxDim
    } else {
      opts.height = maxDim
    }
  }

  return img.resize(opts).webp({ quality: WEBP_QUALITY }).toBuffer()
}

async function uploadBuffer(buffer, path, contentType = 'image/webp') {
  // Supprimer si existant (upsert pas toujours fiable)
  await supabase.storage.from(BUCKET).remove([path])
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? '🔍 Mode DRY RUN — aucune écriture' : '🚀 Migration en cours...')

  // 1. Récupérer tous les lieux avec images
  const { data: places, error } = await supabase
    .from('places')
    .select('id, images, author_id')
    .not('images', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Erreur requête places:', error.message)
    process.exit(1)
  }

  // Filtrer les lieux qui ont au moins une image non-Supabase
  const toMigrate = places.filter(p => {
    if (!p.images || !Array.isArray(p.images) || p.images.length === 0) return false
    return p.images.some(img => img.url && !isSupabaseUrl(img.url))
  })

  console.log(`📦 ${places.length} lieux avec images, ${toMigrate.length} à migrer\n`)

  let ok = 0
  let fail = 0

  for (const place of toMigrate) {
    const placeLabel = `[${place.id.slice(0, 8)}]`
    const newImages = []

    for (const img of place.images) {
      if (!img.url) {
        newImages.push(img)
        continue
      }

      // Déjà sur Supabase → juste ajouter le thumb si manquant
      if (isSupabaseUrl(img.url)) {
        newImages.push(img)
        continue
      }

      try {
        console.log(`  ${placeLabel} ⬇️  ${img.url.slice(0, 80)}...`)

        if (DRY_RUN) {
          newImages.push({ ...img, _wouldMigrate: true })
          continue
        }

        // Télécharger
        const original = await downloadImage(img.url)
        console.log(`  ${placeLabel} 📥  ${(original.length / 1024 / 1024).toFixed(1)} Mo`)

        // Redimensionner
        const [fullBuf, thumbBuf] = await Promise.all([
          resizeToWebp(original, FULL_MAX),
          resizeToWebp(original, THUMB_MAX),
        ])
        console.log(`  ${placeLabel} 📐  full: ${(fullBuf.length / 1024).toFixed(0)} Ko, thumb: ${(thumbBuf.length / 1024).toFixed(0)} Ko`)

        // Upload
        const imageId = img.id || crypto.randomUUID()
        const authorId = place.author_id || 'legacy'
        const fullPath = `places/${authorId}/${imageId}.webp`
        const thumbPath = `places/${authorId}/${imageId}_thumb.webp`

        const [fullUrl, thumbUrl] = await Promise.all([
          uploadBuffer(fullBuf, fullPath),
          uploadBuffer(thumbBuf, thumbPath),
        ])

        newImages.push({ id: imageId, url: fullUrl, thumb: thumbUrl })
        console.log(`  ${placeLabel} ✅  migré`)

      } catch (err) {
        console.error(`  ${placeLabel} ❌  ${err.message}`)
        // Garder l'ancienne image en cas d'erreur
        newImages.push(img)
        fail++
      }
    }

    // Mettre à jour le lieu
    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('places')
        .update({ images: newImages, updated_at: new Date().toISOString() })
        .eq('id', place.id)

      if (updateError) {
        console.error(`  ${placeLabel} ❌ update DB: ${updateError.message}`)
        fail++
      } else {
        ok++
      }
    } else {
      ok++
    }
  }

  console.log(`\n🏁 Terminé : ${ok} migrés, ${fail} erreurs`)
}

main().catch(err => {
  console.error('💥 Erreur fatale:', err)
  process.exit(1)
})
