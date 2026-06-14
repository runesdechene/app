-- 252_fragment_unlocks_by_tag_exact_again.sql
-- WHY : revert de la tolérance introduite en 251. Le webhook d'unlock
-- (apps/hub/netlify/functions/shopify-order-webhook.ts) matche le tag produit de façon
-- EXACTE (PostgREST `shopify_unlocks?shopify_tag=in.("fragment:avalon",...)`), sans
-- normalisation. Une fiche tolérante (251) afficherait un titre pour un tag mal écrit
-- (ex. 'fragment-avalon', 'Fragment:Avalon') que l'achat ne débloquerait PAS → fausse
-- promesse. On réaligne la fiche sur l'unlock : match exact. Conséquence voulue : si le
-- titre n'apparaît pas sur la fiche, c'est que le tag est mauvais (et l'unlock casserait
-- aussi) — la fiche devient un détecteur d'erreur de tag, source de vérité = le tag exact.

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
