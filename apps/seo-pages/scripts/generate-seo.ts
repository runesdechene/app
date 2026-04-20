import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function getStalePlaces() {
  const { data, error } = await supabase
    .from('places')
    .select(`
      id, title, text, address, accessibility,
      place_types ( title )
    `)
    .not('slug', 'is', null)
    .or('seo_description.is.null,seo_generated_at.lt.updated_at')
    .eq('private', false)
    .eq('masked', false)
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

async function getContributionsForPlace(placeId: string) {
  const { data, error } = await supabase
    .from('place_contributions')
    .select('content, votes_up, votes_down, type')
    .eq('place_id', placeId)
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
    .filter((c) => c.content.trim().length > 10)
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
  const places = await getStalePlaces();

  if (places.length === 0) {
    console.log('All SEO descriptions are up to date.');
    return;
  }

  console.log(`Processing ${places.length} places...`);
  let processed = 0;

  for (const place of places) {
    const contributions = await getContributionsForPlace(place.id);
    const placeType = (place as any).place_types?.title ?? 'Lieu';

    console.log(`  ${place.title} (${contributions.length} contributions)...`);

    const description = await generateDescription(
      place.title,
      placeType,
      place.text,
      place.address,
      contributions
    );

    const { error } = await supabase
      .from('places')
      .update({
        seo_description: description,
        seo_generated_at: new Date().toISOString(),
      })
      .eq('id', place.id);

    if (error) {
      console.error(`    Failed: ${error.message}`);
    } else {
      console.log(`    Done (${description.length} chars)`);
      processed++;
    }
  }

  console.log(`\nProcessed ${processed}/${places.length} places.`);
}

run().catch(console.error);
