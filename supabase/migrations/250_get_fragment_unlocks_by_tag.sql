-- 250_get_fragment_unlocks_by_tag.sql
-- WHY : la fiche produit Shopify (section rdc_fragment-app) doit afficher le Titre in-game
-- débloqué par un Fragment, depuis le Hub (source de vérité) — sans dupliquer la donnée en
-- metafield Shopify. Mapping : tag produit Shopify (shopify_unlocks.shopify_tag, ex.
-- 'fragment:hibou') -> fragment (unlock_ref_id) -> fragment_words.nom (slot 'nom').
-- Lecture seule, exposée anon comme get_community_photos_by_product.
-- Si plusieurs variantes de nom (genre), renvoie la première (order by id) — la fiche n'a
-- pas de joueur connecté donc pas de genre à résoudre.

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
    and su.shopify_tag = p_tag
  order by fw.id
  limit 1;
$$;

grant execute on function public.get_fragment_unlocks_by_tag(text) to anon;
