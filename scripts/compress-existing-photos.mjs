/**
 * Script one-shot : compresse et convertit en WebP toutes les photos
 * existantes du bucket community-photos.
 *
 * Usage :
 *   node scripts/compress-existing-photos.mjs
 *
 * Prérequis :
 *   pnpm add -w sharp @supabase/supabase-js
 *
 * Variables d'environnement (dans .env à la racine) :
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY       (ou SUPABASE_SERVICE_ROLE_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY     (recommandé — nécessaire pour delete/update)
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Config ──────────────────────────────────────────────────────────
const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 82;
const BUCKET = "community-photos";
const DRY_RUN = process.argv.includes("--dry-run");

// ── Charger .env manuellement (pas de dépendance dotenv) ────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
let envVars = {};
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
  }
} catch {
  // pas de .env, on utilise process.env
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  envVars.VITE_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  envVars.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  envVars.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.");
  console.error("   Ajoute SUPABASE_SERVICE_ROLE_KEY=... dans ton .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ─────────────────────────────────────────────────────────
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "bmp", "tiff", "tif", "heic", "heif", "avif"]);

function isImagePath(path) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTS.has(ext);
}

function isAlreadyWebp(path) {
  return path.toLowerCase().endsWith(".webp");
}

function toWebpPath(path) {
  return path.replace(/\.[^.]+$/, ".webp");
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Récupération des images en base...");
  if (DRY_RUN) console.log("   (mode --dry-run, aucune modification)");

  // 1. Lister toutes les images depuis la DB
  const { data: images, error: dbError } = await supabase
    .from("hub_submission_images")
    .select("id, storage_path, image_url")
    .order("created_at", { ascending: true });

  if (dbError) {
    console.error("❌ Erreur DB:", dbError.message);
    process.exit(1);
  }

  const toProcess = images.filter(
    (img) => isImagePath(img.storage_path) && !isAlreadyWebp(img.storage_path)
  );

  console.log(`📊 ${images.length} fichiers en base, ${toProcess.length} à compresser.\n`);

  if (toProcess.length === 0) {
    console.log("✅ Rien à faire, toutes les images sont déjà en WebP.");
    return;
  }

  let success = 0;
  let skipped = 0;
  let failed = 0;
  let savedBytes = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const img = toProcess[i];
    const num = `[${i + 1}/${toProcess.length}]`;

    try {
      // 2. Télécharger le fichier original
      const { data: blob, error: dlError } = await supabase.storage
        .from(BUCKET)
        .download(img.storage_path);

      if (dlError || !blob) {
        console.log(`  ⚠️  ${num} Skip (download failed): ${img.storage_path}`);
        skipped++;
        continue;
      }

      const originalSize = blob.size;
      const buffer = Buffer.from(await blob.arrayBuffer());

      // 3. Compresser avec sharp
      const compressed = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const newSize = compressed.length;
      const ratio = ((1 - newSize / originalSize) * 100).toFixed(0);

      // Skip si la compression n'apporte rien
      if (newSize >= originalSize) {
        console.log(`  ⏭️  ${num} Skip (déjà optimisé): ${img.storage_path}`);
        skipped++;
        continue;
      }

      const newPath = toWebpPath(img.storage_path);

      if (DRY_RUN) {
        console.log(
          `  📋 ${num} ${img.storage_path} → ${(originalSize / 1024).toFixed(0)}Ko → ${(newSize / 1024).toFixed(0)}Ko (-${ratio}%)`
        );
        savedBytes += originalSize - newSize;
        success++;
        continue;
      }

      // 4. Upload le fichier WebP
      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .upload(newPath, compressed, {
          contentType: "image/webp",
          upsert: true,
        });

      if (upError) {
        console.log(`  ❌ ${num} Upload failed: ${upError.message}`);
        failed++;
        continue;
      }

      // 5. Récupérer la nouvelle URL publique
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(newPath);

      // 6. Mettre à jour la DB
      const { error: updateError } = await supabase
        .from("hub_submission_images")
        .update({
          storage_path: newPath,
          image_url: urlData.publicUrl,
        })
        .eq("id", img.id);

      if (updateError) {
        console.log(`  ❌ ${num} DB update failed: ${updateError.message}`);
        // Supprimer le fichier WebP uploadé pour ne pas laisser de fichier orphelin
        await supabase.storage.from(BUCKET).remove([newPath]);
        failed++;
        continue;
      }

      // 7. Supprimer l'ancien fichier
      if (newPath !== img.storage_path) {
        await supabase.storage.from(BUCKET).remove([img.storage_path]);
      }

      savedBytes += originalSize - newSize;
      success++;
      console.log(
        `  ✅ ${num} ${img.storage_path} → .webp  ${(originalSize / 1024).toFixed(0)}Ko → ${(newSize / 1024).toFixed(0)}Ko (-${ratio}%)`
      );
    } catch (err) {
      console.log(`  ❌ ${num} Error: ${err.message}`);
      failed++;
    }
  }

  // Résumé
  console.log("\n" + "─".repeat(50));
  console.log(`✅ Compressées : ${success}`);
  console.log(`⏭️  Skippées   : ${skipped}`);
  console.log(`❌ Échouées   : ${failed}`);
  console.log(`💾 Espace gagné: ${(savedBytes / 1024 / 1024).toFixed(1)} Mo`);
  if (DRY_RUN) console.log("\n⚠️  Mode --dry-run, aucune modification effectuée.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
