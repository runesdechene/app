-- WHY: Relevé le 23/10 au premier passage de la 553 : une fiche dont le client Shopify est déjà relié à une
--      autre fiche (même adresse à la casse près) violait idx_users_shopify_customer_id et faisait échouer tout
--      le lot de 1 000. Le lien en double est désormais sauté ; l'accord, lui, est posé.
--      Définition de la 553 (appliquée ce jour) recopiée entière ; seul le lien change.
-- SCHEMA CHECKED (23/10/2026, live) : index unique idx_users_shopify_customer_id sur users(shopify_customer_id).

CREATE OR REPLACE FUNCTION public.synchro_lier_clients(p jsonb)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH faits AS (
    UPDATE users u
       SET shopify_customer_id = COALESCE(
             u.shopify_customer_id,
             -- Un client Shopify déjà relié à une autre fiche ne se relie pas deux fois.
             CASE WHEN NOT EXISTS (SELECT 1 FROM users autre WHERE autre.shopify_customer_id = r.shopify_customer_id)
                  THEN r.shopify_customer_id END),
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
