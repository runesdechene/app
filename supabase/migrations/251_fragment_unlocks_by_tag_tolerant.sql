-- 251_fragment_unlocks_by_tag_tolerant.sql
-- WHY : get_fragment_unlocks_by_tag (mig 250) matchait le tag produit de façon EXACTE
-- (su.shopify_tag = p_tag). Or les tags produit Shopify varient en casse, séparateur
-- (':' vs '-', ex. fragment-skjaldmo) et espaces → la fiche n'affichait pas le titre
-- (ex. Avalon taggé autrement que 'fragment:avalon' tombait sur null).
-- Delta : on matche sur le SLUG normalisé des deux côtés (lower + trim + on retire le
-- préfixe 'fragment' et tout séparateur :_- ou espace). Vérifié : les 11 tags de
-- shopify_unlocks produisent 11 slugs uniques (zéro collision). Reste lecture seule, anon.

create or replace function public.get_fragment_unlocks_by_tag(p_tag text)
returns table (titre text)
language sql
stable
security definer
set search_path = public
as $$
  select fw.word
  from public.shopify_unlocks su
  join public.fragment_words fw
    on fw.fragment_id = su.unlock_ref_id
   and fw.slot = 'nom'
  where su.unlock_type = 'fragment'
    and regexp_replace(lower(btrim(su.shopify_tag)), '^fragment[:_ -]*', '')
      = regexp_replace(lower(btrim(p_tag)), '^fragment[:_ -]*', '')
  order by fw.id
  limit 1;
$$;

grant execute on function public.get_fragment_unlocks_by_tag(text) to anon;
