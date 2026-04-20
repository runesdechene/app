import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateSlugs() {
  const { data: places, error } = await supabase
    .from('places')
    .select('id, title, slug')
    .is('slug', null);

  if (error) throw error;
  if (!places?.length) {
    console.log('All places already have slugs.');
    return;
  }

  console.log(`Generating slugs for ${places.length} places...`);

  const { data: existingSlugs } = await supabase
    .from('places')
    .select('slug')
    .not('slug', 'is', null);

  const usedSlugs = new Set((existingSlugs ?? []).map((p: any) => p.slug));

  for (const place of places) {
    let slug = slugify(place.title);
    let candidate = slug;
    let counter = 1;

    while (usedSlugs.has(candidate)) {
      candidate = `${slug}-${counter}`;
      counter++;
    }

    usedSlugs.add(candidate);

    const { error: updateError } = await supabase
      .from('places')
      .update({ slug: candidate })
      .eq('id', place.id);

    if (updateError) {
      console.error(`Failed to set slug for "${place.title}": ${updateError.message}`);
    } else {
      console.log(`  ${place.title} → ${candidate}`);
    }
  }

  console.log('Done.');
}

generateSlugs().catch(console.error);
