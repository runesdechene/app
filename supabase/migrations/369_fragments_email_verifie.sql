-- 369 — Les Fragments achetés ne se réclament qu'avec son propre e-mail
--
-- WHY : trouvé le 28/09/2026 en préparant l'onboarding V2. unlock_pending_fragments recevait
--   l'e-mail de l'APPELANT (p_email) sans le vérifier : n'importe quel compte connecté pouvait
--   réclamer les Fragments en attente d'un achat fait par quelqu'un d'autre, en tapant son
--   e-mail. On lit désormais l'e-mail vérifié par la connexion (le jeton, auth.jwt()). p_email
--   reste dans la signature pour ne pas casser la V1, mais il n'est plus lu.
--   Définition live du 28/09/2026, copiée entière ; seule change la condition sur l'e-mail.
--
-- SCHEMA CHECKED (28/09/2026) : purchase_log(id int, email varchar, status varchar,
--   unlock_type varchar, unlock_ref_id int, user_id varchar) ; user_fragments(user_id varchar,
--   fragment_id int, source varchar, unique(user_id, fragment_id)).

CREATE OR REPLACE FUNCTION public.unlock_pending_fragments(p_user_id text, p_email text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INT := 0;
  v_row RECORD;
  -- L'e-mail que la connexion a vérifié : jamais celui que l'appelant prétend avoir.
  v_email text := NULLIF(lower(btrim(auth.jwt()->>'email')), '');
BEGIN
  -- 347 — garde d'identité (audit du 27/09/2026) : on n'agit que pour son propre compte.
  IF p_user_id IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'Action refusée : tu ne peux agir que pour ton propre compte' USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;
  FOR v_row IN
    SELECT id, unlock_ref_id
    FROM purchase_log
    WHERE lower(email) = v_email
      AND status = 'pending'
      AND unlock_type = 'fragment'
  LOOP
    -- Inserer le fragment (ignore si deja present)
    INSERT INTO user_fragments (user_id, fragment_id, source)
    VALUES (p_user_id, v_row.unlock_ref_id, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;

    -- Mettre a jour le log
    UPDATE purchase_log
    SET user_id = p_user_id, status = 'unlocked'
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
