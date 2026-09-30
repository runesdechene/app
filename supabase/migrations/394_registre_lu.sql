-- WHY: Uriel, 30/09 : dans Messages, les Murmures non lus ont leur pastille rouge ; les messages
--      ratés de « La communauté » (le Registre) doivent se voir aussi, en plus discret. Il faut
--      savoir où chacun s'est arrêté de lire : le dernier message vu, gardé en base (le même
--      point sur le téléphone et le PC ; la V1 le tenait dans le navigateur).
--      Sans ligne (jamais ouvert le Registre en V2), rien n'est « raté » : pas de point pour
--      des milliers de messages anciens.
--      Uriel, 30/09 (suite) : être mentionné (@Nom) dans le Registre vaut une pastille rouge, comme
--      un Murmure ; registre_non_lus rend donc deux nombres : les messages ratés, et les mentions
--      de moi pas encore vues (depuis toujours si je n'ai jamais ouvert le Registre en V2 —
--      les mentions n'existent que depuis la 373, le 29/09).
-- SCHEMA CHECKED (30/09/2026, information_schema live) : chat_messages(id bigint, channel
--      varchar, user_id varchar, user_name, content, created_at) ; chat_mentions(message_id,
--      user_id) (373) ; canaux du Registre V2 : 'general', 'bugs' (ecrire_au_registre, 373).

CREATE TABLE IF NOT EXISTS public.registre_lu (
  user_id varchar PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lu_jusqua bigint NOT NULL DEFAULT 0,
  maj timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.registre_lu ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registre_lu FROM PUBLIC, anon, authenticated;

-- Ce qui m'attend au Registre depuis mon dernier passage : les messages des autres (plafonnés :
-- on n'en montre qu'un point) et les mentions de moi (une pastille rouge, avec leur nombre).
CREATE OR REPLACE FUNCTION public.registre_non_lus()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (
    SELECT (auth.uid())::text AS id,
           (SELECT r.lu_jusqua FROM registre_lu r WHERE r.user_id = (auth.uid())::text) AS lu
  )
  SELECT json_build_object(
    'messages', (
      SELECT count(*)::int FROM (
        SELECT 1 FROM chat_messages m, moi
        WHERE moi.lu IS NOT NULL AND m.id > moi.lu
          AND m.channel IN ('general', 'bugs')
          AND m.user_id IS DISTINCT FROM moi.id
        LIMIT 100) x),
    'mentions', (
      SELECT count(*)::int
      FROM chat_mentions cm JOIN chat_messages m ON m.id = cm.message_id, moi
      WHERE cm.user_id = moi.id AND m.id > COALESCE(moi.lu, 0)))
  FROM moi
  WHERE moi.id IS NOT NULL;
$function$;
REVOKE ALL ON FUNCTION public.registre_non_lus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registre_non_lus() TO authenticated;

-- J'ai lu le Registre jusqu'au dernier message.
CREATE OR REPLACE FUNCTION public.marquer_registre_lu()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  INSERT INTO registre_lu (user_id, lu_jusqua, maj)
  SELECT (auth.uid())::text,
         COALESCE((SELECT max(id) FROM chat_messages WHERE channel IN ('general', 'bugs')), 0),
         now()
  WHERE auth.uid() IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE SET lu_jusqua = EXCLUDED.lu_jusqua, maj = now();
$function$;
REVOKE ALL ON FUNCTION public.marquer_registre_lu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marquer_registre_lu() TO authenticated;
