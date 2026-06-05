import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';
import { isRichText, seoSourceHash } from '../src/lib/seo';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const PAGE_SIZE = 1000;

interface Candidate {
  id: string;
  title: string;
  text: string | null;
  address: string | null;
  seo_description: string | null;
  seo_source_hash: string | null;
  place_types: { title: string } | null;
}

// Tous les lieux publics indexables. On filtre/diff côté JS car la décision
// (texte riche ? hash à jour ?) dépend de calculs non exprimables en PostgREST.
async function getCandidates(): Promise<Candidate[]> {
  let all: Candidate[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('places')
      .select(`
        id, title, text, address, seo_description, seo_source_hash,
        place_types ( title )
      `)
      .not('slug', 'is', null)
      .eq('private', false)
      .eq('masked', false)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as unknown as Candidate[]);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function getContributionsForPlace(placeId: string) {
  const { data, error } = await supabase
    .from('place_contributions')
    .select('content, votes_up, votes_down, type')
    .eq('place_id', placeId)
    .eq('type', 'carnet')
    .order('votes_up', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function generateDescription(
  title: string,
  placeType: string,
  text: string,
  address: string,
  contributions: { content: string; votes_up: number; type: string }[]
): Promise<string> {
  const contribTexts = contributions
    .filter((c) => c.content && c.content.trim().length > 10)
    .map((c, i) => `Récit ${i + 1} (${c.votes_up} votes, type: ${c.type}) : ${c.content}`)
    .join('\n\n');

  const prompt = `Tu es un rédacteur SEO pour Runes de Chêne, une application française de découverte de lieux historiques, naturels et patrimoniaux.

Écris une description SEO de 150 à 200 mots pour ce lieu. La description doit :
- Être factuelle et riche en mots-clés naturels (type de lieu, région, activités)
- Synthétiser les récits des visiteurs sans les copier mot pour mot
- Ne citer QUE des faits historiques vérifiables — en cas de doute, omettre plutôt qu'inventer
- Être engageante et donner envie de découvrir le lieu via l'application

**Lieu :** ${title}
**Type :** ${placeType}
**Adresse :** ${address || 'Non renseignée'}
**Description originale :** ${text || 'Aucune'}

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
  return block.text.trim();
}

async function run() {
  const candidates = await getCandidates();
  console.log(`${candidates.length} lieux publics à évaluer.\n`);

  let generated = 0;
  let skippedRich = 0;
  let upToDate = 0;
  let processed = 0;

  for (const place of candidates) {
    processed++;
    const userText = (place.text ?? '').trim();

    // 1. Texte utilisateur riche → affiché tel quel, aucun appel Haiku.
    if (isRichText(userText)) {
      skippedRich++;
      continue;
    }

    // 2. Texte pauvre → Haiku en secours. On régénère si jamais généré ou
    //    si la source (texte + récits) a changé depuis la dernière fois.
    const contributions = await getContributionsForPlace(place.id);
    const hash = seoSourceHash(userText, contributions.map((c) => c.content ?? ''));

    if (place.seo_description && place.seo_source_hash === hash) {
      upToDate++;
      continue;
    }

    const placeType = place.place_types?.title ?? 'Lieu';
    console.log(`  [${processed}/${candidates.length}] ${place.title} (${contributions.length} récits)${place.seo_description ? ' ↻ refresh' : ''}...`);

    try {
      const description = await generateDescription(
        place.title,
        placeType,
        userText,
        place.address ?? '',
        contributions
      );

      const { error } = await supabase
        .from('places')
        .update({
          seo_description: description,
          seo_generated_at: new Date().toISOString(),
          seo_source_hash: hash,
        })
        .eq('id', place.id);

      if (error) {
        console.error(`    ✗ DB: ${error.message}`);
      } else {
        console.log(`    ✓ ${description.length} chars`);
        generated++;
      }
    } catch (err: any) {
      if (err?.status === 429) {
        console.log('    ⏳ Rate limit — pause 60s...');
        await new Promise((r) => setTimeout(r, 60_000));
      } else {
        console.error(`    ✗ API: ${err.message}`);
      }
    }
  }

  console.log(`\nTerminé — ${generated} générées · ${skippedRich} texte riche (skip) · ${upToDate} déjà à jour.`);
}

run().catch(console.error);
