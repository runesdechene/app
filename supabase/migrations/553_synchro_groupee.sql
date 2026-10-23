-- WHY: La synchro Shopify écrivait une requête par fiche : 3 000 fiches à mettre à jour dépassaient ses
--      60 s, elle était coupée sans rendre de compte (23/10, l'accord de 2 600 abonnés manquait). Elle envoie
--      désormais ses changements par lots à synchro_lier_clients, qui les écrit en une seule requête.
--      Un champ absent du lot ne change rien : le client Shopify déjà relié reste, l'accord ne bouge que s'il
--      est fourni (lib/accord.ts décide, comme avant).
-- SCHEMA CHECKED (23/10/2026, live) : users(id varchar, shopify_customer_id bigint, accord_nouvelles boolean,
--   accord_nouvelles_le timestamptz, accord_nouvelles_porte text).

CREATE FUNCTION public.synchro_lier_clients(p jsonb)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH faits AS (
    UPDATE users u
       SET shopify_customer_id = COALESCE(u.shopify_customer_id, r.shopify_customer_id),
           accord_nouvelles = COALESCE(r.accord_nouvelles, u.accord_nouvelles),
           accord_nouvelles_le = COALESCE(r.accord_nouvelles_le, u.accord_nouvelles_le),
           accord_nouvelles_porte = COALESCE(r.accord_nouvelles_porte, u.accord_nouvelles_porte)
      FROM jsonb_to_recordset(p) AS r(id varchar, shopify_customer_id bigint, accord_nouvelles boolean,
                                      accord_nouvelles_le timestamptz, accord_nouvelles_porte text)
     WHERE u.id = r.id
    RETURNING 1
  )
  SELECT count(*)::integer FROM faits;
$function$;

REVOKE ALL ON FUNCTION public.synchro_lier_clients(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.synchro_lier_clients(jsonb) TO service_role;
