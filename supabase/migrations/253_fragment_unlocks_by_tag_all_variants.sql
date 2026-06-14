-- 253_fragment_unlocks_by_tag_all_variants.sql
-- WHY : un Fragment peut avoir 2 titres (paires genrées : Porteur/Porteuse de bouclier,
-- Druide/Druidesse, Prêtre/Prêtresse de la Morrigan, Valkyrie/Hersir). La 252 faisait
-- `order by id limit 1` → ne renvoyait qu'UNE variante (arbitraire selon l'id). Sur la fiche
-- produit il n'y a pas de joueur connecté donc pas de genre à résoudre → on renvoie les
-- DEUX, joints par ' / ', en ordre alpha (masculin d'abord pour ces paires FR) et trim
-- (le nom 'Prêtresse de la Morrigan ' a un espace en trop). Reste lecture seule, anon, match exact.

create or replace function public.get_fragment_unlocks_by_tag(p_tag text)
returns table (titre text)
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(btrim(fw.word), ' / ' order by btrim(fw.word))
  from public.shopify_unlocks su
  join public.fragment_words fw
    on fw.fragment_id = su.unlock_ref_id
   and fw.slot = 'nom'
  where su.unlock_type = 'fragment'
    and su.shopify_tag = p_tag;
$$;

grant execute on function public.get_fragment_unlocks_by_tag(text) to anon;
