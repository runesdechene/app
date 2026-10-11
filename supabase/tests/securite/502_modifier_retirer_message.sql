-- 502 : on modifie son message pendant 15 minutes, on le retire quand on veut ; jamais celui d'un
-- autre. Retiré, il perd son texte et ses cœurs ; un murmure retiré n'est plus un non-lu. Annulé.
BEGIN;
\ir ../../migrations/502_modifier_retirer_message.sql
DO $test$
DECLARE
  a text := (SELECT id FROM users WHERE supprime_le IS NULL AND id IN (SELECT id::text FROM auth.users) ORDER BY created_at LIMIT 1);
  b text := (SELECT id FROM users WHERE supprime_le IS NULL AND id IN (SELECT id::text FROM auth.users) ORDER BY created_at LIMIT 1 OFFSET 1);
  r text := ''; msg bigint; mur bigint; ligne json;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.ecrire_au_registre('general', 'Premier jet', '{}');
  SELECT max(id) INTO msg FROM chat_messages WHERE user_id = a;
  mur := (public.murmurer(b, 'Coucou')->>'id')::bigint;
  PERFORM public.modifier_message(msg, 'Version propre');
  PERFORM public.modifier_murmure(mur, 'Bonjour');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.aimer_message(msg, true);
  BEGIN PERFORM public.modifier_message(msg, 'Pirate'); r := r || ' autre_modifie=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' autre_modifie=refus'; END;
  BEGIN PERFORM public.retirer_message(msg); r := r || ' autre_retire=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' autre_retire=refus'; END;
  BEGIN PERFORM public.retirer_murmure(mur); r := r || ' autre_murmure=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' autre_murmure=refus'; END;
  r := r || ' nonlu_avant=' || (SELECT f->>'nonLus' FROM json_array_elements(public.mes_murmures()) f WHERE f->'avec'->>'id' = a);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT x INTO ligne FROM json_array_elements(public.registre(ARRAY['general'], 200)) x WHERE (x->>'id')::bigint = msg;
  r := r || ' texte=' || (ligne->>'texte') || ' modifie=' || (ligne->>'modifie') || ' coeurs=' || json_array_length(ligne->'coeurs');
  PERFORM public.retirer_message(msg);
  PERFORM public.retirer_murmure(mur);
  SELECT x INTO ligne FROM json_array_elements(public.registre(ARRAY['general'], 200)) x WHERE (x->>'id')::bigint = msg;
  r := r || ' | retire=' || (ligne->>'retire') || ' texte=' || COALESCE(ligne->>'texte', 'NULL') || ' coeurs=' || json_array_length(ligne->'coeurs');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.aimer_message(msg, true); r := r || ' aimer_retire=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' aimer_retire=refus'; END;
  SELECT f INTO ligne FROM json_array_elements(public.mes_murmures()) f WHERE f->'avec'->>'id' = a;
  r := r || ' nonlu_apres=' || (ligne->>'nonLus') || ' dernier_retire=' || (ligne->'dernier'->>'retire');

  -- Passé 15 minutes, on ne modifie plus.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.ecrire_au_registre('general', 'Ancien', '{}');
  RESET ROLE;
  SELECT max(id) INTO msg FROM chat_messages WHERE user_id = a;
  UPDATE chat_messages SET created_at = now() - interval '16 minutes' WHERE id = msg;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.modifier_message(msg, 'Trop tard'); r := r || ' tard=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' tard=refus'; END;
  BEGIN PERFORM public.retirer_message(msg); r := r || ' retrait_tard=ok'; EXCEPTION WHEN others THEN r := r || ' retrait_tard=REFUS'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN%', r;
END $test$;
ROLLBACK;
