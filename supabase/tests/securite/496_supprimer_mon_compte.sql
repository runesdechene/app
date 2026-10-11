-- 496 : supprimer son compte. Un chef de Compagnie qui a ajouté des lieux : ses lieux restent,
--       signés « Un Voyageur » ; ses traces partent ; la chefferie passe ; il ne peut plus se
--       connecter. Annulé.
BEGIN;
\ir ../../migrations/496_supprimer_mon_compte.sql
DO $test$
DECLARE
  qui text; compagnie text; lieux_avant int; lieux_apres int; nom text; courriel text;
  traces int; connexion int; nouveau_chef text; murmures_restants int;
BEGIN
  SELECT m.user_id, m.faction_id INTO qui, compagnie FROM faction_members m
   WHERE m.role = 'chef' AND EXISTS (SELECT 1 FROM places p WHERE p.author_id = m.user_id)
     AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id AND u.role = 'admin')
     AND EXISTS (SELECT 1 FROM faction_members o WHERE o.faction_id = m.faction_id AND o.user_id <> m.user_id)
     AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id::text = m.user_id)
   LIMIT 1;
  SELECT count(*) INTO lieux_avant FROM places WHERE author_id = qui;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', qui, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.supprimer_mon_compte();
  RESET ROLE;

  SELECT count(*) INTO lieux_apres FROM places WHERE author_id = qui;
  SELECT COALESCE(display_name, first_name), email_address INTO nom, courriel FROM users WHERE id = qui;
  SELECT (SELECT count(*) FROM place_explorers WHERE user_id = qui) + (SELECT count(*) FROM notifications WHERE recipient_id = qui)
       + (SELECT count(*) FROM push_subscriptions WHERE user_id = qui) + (SELECT count(*) FROM faction_members WHERE user_id = qui)
    INTO traces;
  SELECT count(*) INTO connexion FROM auth.users WHERE id::text = qui;
  SELECT user_id INTO nouveau_chef FROM faction_members WHERE faction_id = compagnie AND role = 'chef';
  SELECT count(*) INTO murmures_restants FROM murmures WHERE de = qui OR a = qui;

  RAISE EXCEPTION 'BILAN lieux %->% (attendu égaux) nom=% (attendu Un Voyageur) courriel=% (attendu vide) traces=% (attendu 0) connexion=% (attendu 0) nouveau_chef=% (attendu un autre) murmures=% (attendu 0)',
    lieux_avant, lieux_apres, nom, courriel, traces, connexion, (nouveau_chef IS NOT NULL AND nouveau_chef <> qui), murmures_restants;
END $test$;
ROLLBACK;
