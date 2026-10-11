-- WHY: audit du 11/10/2026 — 250 fonctions SECURITY DEFINER s'appelaient sans compte (clé anon),
--      la plupart par le droit EXECUTE que Postgres donne à PUBLIC par défaut. Certaines n'avaient
--      rien à y faire : moderate_review, moderate_submission, set_submission_image_* (modération du
--      Hub), revisit_place_gps, get_my_*… L'audit du 27/09 avait trouvé 41 fonctions qui se
--      croyaient protégées et ne l'étaient pas : on ne parie plus sur les gardes internes.
--   Sans compte, ne s'appelle plus que ce qui sert sans compte (liste ci-dessous) : la vitrine et
--   sa carte, le scan, l'invitation d'une Compagnie, le thème Shopify, le dépôt public du Studio,
--   et les deux fonctions de rôle que lisent les politiques. Ce que les autres rôles
--   (authenticated, service_role, supabase_auth_admin) pouvaient appeler, ils le peuvent encore.
--   Les fonctions à venir naissent fermées à anon et ouvertes à authenticated : une fonction
--   publique se déclare (GRANT … TO anon), comme la vitrine le fait déjà (391, 484).
-- SCHEMA CHECKED (11/10/2026, pg_proc live) : les appels sans compte relevés dans le code
--   (features/vitrine, carte en mode visiteur, scan, app/access/Invitation, thème Shopify :
--   sections, snippets, assets ; Hub StudioSubmit) ; les fonctions des extensions ne sont pas
--   touchées (pg_depend 'e').

DO $migration$
DECLARE
  ouvertes text[] := ARRAY[
    -- la vitrine et la carte des visiteurs
    'get_landing_stats', 'natures_publiques', 'recherche_publique', 'activite_publique',
    'apercu_lieu', 'lieux_au_hasard', 'carte_publique',
    -- le scan, le récit d'un Fragment
    'empreintes_du_scan', 'recit_du_fragment', 'noter_scan',
    -- le lien d'invitation d'une Compagnie, avant la connexion
    'compagnie_par_lien',
    -- le thème Shopify
    'get_approved_photos_by_tag', 'get_community_photos_by_product',
    'get_fragment_unlocks_by_tag', 'get_fragment_unlocks_by_product', 'log_fragment_audio_play',
    -- le dépôt public du Studio (Hub)
    'get_studio_config', 'create_photo_submission', 'add_submission_image',
    'create_user_from_submission',
    -- lues par des politiques que anon traverse
    '_is_staff', '_is_admin'
  ];
  f record;
  r text;
BEGIN
  FOR f IN
    SELECT p.oid, p.oid::regprocedure AS sig, p.proname,
           array_remove(ARRAY[
             CASE WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'authenticated' END,
             CASE WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') THEN 'service_role' END,
             CASE WHEN has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE') THEN 'supabase_auth_admin' END
           ], NULL) AS gardent
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND pg_get_userbyid(p.proowner) = current_user
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    FOREACH r IN ARRAY f.gardent LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', f.sig, r);
    END LOOP;
    IF f.proname = ANY (ouvertes) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
    END IF;
  END LOOP;
END
$migration$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
