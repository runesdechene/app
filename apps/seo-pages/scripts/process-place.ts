import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

import { getPlaceBySlug, getPlaceContributions, getNearbyPlaces, getTotalPlaceCount } from '../src/lib/places';
import { getShareTextTemplate } from '../src/lib/appSettings';
import { slugify } from '../src/lib/slugify';
import { renderPage } from '../src/templates/page';
import { isRichText, seoSourceHash } from '../src/lib/seo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function ensureSlug(placeId: string): Promise<string> {
  const { data } = await supabase
    .from('places')
    .select('id, title, slug, address')
    .eq('id', placeId)
    .single();

  if (!data) throw new Error(`Place ${placeId} not found`);
  if (data.slug) return data.slug;

  let slug = slugify(data.title);

  const { data: existing } = await supabase
    .from('places')
    .select('slug')
    .eq('slug', slug)
    .single();

  if (existing && data.address) {
    const city = data.address.split(',').slice(-2, -1)[0]?.trim();
    if (city) slug = `${slug}-${slugify(city)}`;
  }

  let candidate = slug;
  let counter = 1;
  while (true) {
    const { data: dup } = await supabase
      .from('places')
      .select('slug')
      .eq('slug', candidate)
      .single();
    if (!dup) break;
    candidate = `${slug}-${counter}`;
    counter++;
  }

  await supabase.from('places').update({ slug: candidate }).eq('id', placeId);
  console.log(`  Slug: ${candidate}`);
  return candidate;
}

async function ensureSeoDescription(placeId: string): Promise<void> {
  const { data } = await supabase
    .from('places')
    .select('id, title, text, address, seo_description, seo_source_hash, place_types(title)')
    .eq('id', placeId)
    .single();

  if (!data) throw new Error(`Place ${placeId} not found`);

  const userText = (data.text ?? '').trim();
  // Texte utilisateur riche → affiché tel quel, pas d'appel Haiku.
  if (isRichText(userText)) return;

  const { data: contribs } = await supabase
    .from('place_contributions')
    .select('content, votes_up, type')
    .eq('place_id', placeId)
    .eq('type', 'carnet')
    .order('votes_up', { ascending: false });

  // Régénère si jamais généré, ou si la source (texte + récits) a changé.
  const hash = seoSourceHash(userText, (contribs ?? []).map((c) => c.content ?? ''));
  if (data.seo_description && data.seo_source_hash === hash) return;

  const placeType = (data as any).place_types?.title ?? 'Lieu';
  const contribTexts = (contribs ?? [])
    .filter(c => c.content && c.content.trim().length > 10)
    .map((c, i) => `Récit ${i + 1} (${c.votes_up} votes, type: ${c.type}) : ${c.content}`)
    .join('\n\n');

  const prompt = `Tu es un rédacteur SEO pour Runes de Chêne, une application française de découverte de lieux historiques, naturels et patrimoniaux.

Écris une description SEO de 150 à 200 mots pour ce lieu. La description doit :
- Être factuelle et riche en mots-clés naturels (type de lieu, région, activités)
- Synthétiser les récits des visiteurs sans les copier mot pour mot
- Ne citer QUE des faits historiques vérifiables — en cas de doute, omettre plutôt qu'inventer
- Être engageante et donner envie de découvrir le lieu via l'application

**Lieu :** ${data.title}
**Type :** ${placeType}
**Adresse :** ${data.address || 'Non renseignée'}
**Description originale :** ${userText || 'Aucune'}

**Récits des visiteurs :**
${contribTexts || 'Aucun récit disponible.'}

Écris UNIQUEMENT la description, sans titre ni balises.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type');

  await supabase
    .from('places')
    .update({ seo_description: block.text.trim(), seo_generated_at: new Date().toISOString(), seo_source_hash: hash })
    .eq('id', placeId);

  console.log(`  SEO: ${block.text.trim().length} chars`);
}

export async function processPlace(placeId: string): Promise<string> {
  console.log(`Processing place ${placeId}...`);

  const slug = await ensureSlug(placeId);
  await ensureSeoDescription(placeId);

  const place = await getPlaceBySlug(slug);
  if (!place) throw new Error(`Place with slug ${slug} not found after processing`);

  const [contributions, nearby, totalCount, shareTextTemplate] = await Promise.all([
    getPlaceContributions(place.id),
    getNearbyPlaces(place.latitude, place.longitude, place.id),
    getTotalPlaceCount(),
    getShareTextTemplate(),
  ]);

  const placeCount = Math.floor(totalCount / 100) * 100;
  const html = renderPage({ place, contributions, nearby, placeCount, shareTextTemplate });

  const dir = join(DIST, 'lieu', slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html, 'utf-8');

  console.log(`  Written: dist/lieu/${slug}/index.html`);
  return slug;
}

const placeId = process.argv[2];
if (placeId) {
  processPlace(placeId)
    .then(slug => console.log(`\nDone: /lieu/${slug}`))
    .catch(err => { console.error(err); process.exit(1); });
} else {
  console.error('Usage: tsx scripts/process-place.ts <place-id>');
  process.exit(1);
}
