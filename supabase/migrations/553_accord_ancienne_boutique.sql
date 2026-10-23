-- WHY: Les clients importés depuis l'ancienne boutique y avaient donné leur accord aux nouvelles ; l'import dans
--      Shopify les a laissés « jamais abonnés » (Uriel, 23/10 : « ils acceptent tous la lettre »). Ils reçoivent
--      donc les Missives.
--      - Seulement les fiches reliées à un client Shopify, sans aucun choix noté (ni accord, ni refus daté) :
--        les 143 désabonnés Shopify et les 282 comptes de l'appli sans client Shopify restent hors de la lettre.
--      - Porte 'import', datée d'aujourd'hui : on sait d'où vient l'accord et on peut le défaire en une requête.
--      - La porte 'import' n'inscrit à aucune suite (mig 552 : seules site, flyer, appli inscrivent).
--      - Un désabonnement ultérieur, dans le Hub ou sur Shopify, l'emporte (dernière action gagne).
-- SCHEMA CHECKED (23/10/2026, live) : users_accord_nouvelles_porte_check (8 portes) ; 3 244 fiches reliées à
--   Shopify sans choix, aucune supprimée ; 1 356 accords et 143 refus datés venus de la synchro.

ALTER TABLE public.users DROP CONSTRAINT users_accord_nouvelles_porte_check;
ALTER TABLE public.users ADD CONSTRAINT users_accord_nouvelles_porte_check
  CHECK (accord_nouvelles_porte IN ('stand', 'flyer', 'site', 'appli', 'shopify', 'hub', 'desabonnement', 'rebond', 'import'));

UPDATE public.users
   SET accord_nouvelles = true, accord_nouvelles_le = now(), accord_nouvelles_porte = 'import'
 WHERE shopify_customer_id IS NOT NULL
   AND supprime_le IS NULL
   AND NOT accord_nouvelles
   AND accord_nouvelles_le IS NULL;
