-- WHY: Bug relevé par Uriel (23/10) : après avoir posé une photo, changer de palette laissait ses coins à la
--      couleur d'avant. Un e-mail ne sait pas pencher une image : elle part penchée, cuite sur le fond. Le Hub
--      garde désormais la photo droite dans le brouillon (aperçu penché en direct, aux couleurs du moment) et
--      ne la penche qu'à l'essai ou à la programmation, avec les couleurs finales.
--      1. missives.contenu_envoi : la lettre telle qu'elle part (photos penchées). NULL : on envoie contenu.
--      2. hub_enregistrer_missive l'enregistre quand le Hub le fournit. Définition live du 23/10 recopiée
--         entière ; seul contenu_envoi s'ajoute.
-- SCHEMA CHECKED (23/10/2026, live) : missives sans colonne contenu_envoi ; pg_get_functiondef de
--   hub_enregistrer_missive(jsonb) (mig 543).

ALTER TABLE public.missives ADD COLUMN IF NOT EXISTS contenu_envoi jsonb;

CREATE OR REPLACE FUNCTION public.hub_enregistrer_missive(p jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint := (p->>'id')::bigint;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  IF v_id IS NULL THEN
    INSERT INTO missives (modele, couleurs, contenu, contenu_envoi, objet, apercu, liste)
    VALUES (p->>'modele', p->'couleurs', p->'contenu', p->'contenu_envoi', COALESCE(p->>'objet', ''), p->>'apercu', p->>'liste')
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE missives
     SET modele = p->>'modele', couleurs = p->'couleurs', contenu = p->'contenu', contenu_envoi = p->'contenu_envoi',
         objet = COALESCE(p->>'objet', ''), apercu = p->>'apercu', liste = p->>'liste'
   WHERE id = v_id AND statut IN ('brouillon', 'programmee');
  IF NOT FOUND THEN PERFORM _refus('Cette Missive est déjà partie', 'statut'); END IF;
  RETURN v_id;
END;
$function$;
