-- WHY: Missives, lot 1, tâche 8 : écrire dans le modèle, depuis le Hub.
--      1. Le stockage « missives » : les photos des lettres (déjà penchées par le Hub), lues par toutes les
--         boîtes de réception, donc publiques ; seule l'équipe dépose, remplace ou efface.
--      2. hub_enregistrer_missive : crée le brouillon ou l'enregistre ; une Missive partie ne change plus.
--      3. hub_programmer_missive : la Missive part à l'heure dite (le réveil de la mig 541 la prend).
--         Il faut une liste ; « maintenant » se programme à now().
--      Modèle des droits : announcement-covers (mig 222) et _is_admin().
-- SCHEMA CHECKED (23/10/2026, live) : storage.buckets(id, name, public, file_size_limit, allowed_mime_types) ;
--   missives(id, modele, couleurs, contenu, objet, apercu, liste, statut, programmee_le) créée par la 539 ;
--   _is_admin(), _refus(text, text).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('missives', 'missives', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY missives_deposer ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'missives' AND public._is_admin());
CREATE POLICY missives_remplacer ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'missives' AND public._is_admin())
  WITH CHECK (bucket_id = 'missives' AND public._is_admin());
CREATE POLICY missives_effacer ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'missives' AND public._is_admin());

-- p : { id?, modele, couleurs, contenu, objet, apercu, liste }. Rend l'id de la Missive.
CREATE FUNCTION public.hub_enregistrer_missive(p jsonb)
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
    INSERT INTO missives (modele, couleurs, contenu, objet, apercu, liste)
    VALUES (p->>'modele', p->'couleurs', p->'contenu', COALESCE(p->>'objet', ''), p->>'apercu', p->>'liste')
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  UPDATE missives
     SET modele = p->>'modele', couleurs = p->'couleurs', contenu = p->'contenu',
         objet = COALESCE(p->>'objet', ''), apercu = p->>'apercu', liste = p->>'liste'
   WHERE id = v_id AND statut IN ('brouillon', 'programmee');
  IF NOT FOUND THEN PERFORM _refus('Cette Missive est déjà partie', 'statut'); END IF;
  RETURN v_id;
END;
$function$;

CREATE FUNCTION public.hub_programmer_missive(p_id bigint, p_quand timestamptz)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  UPDATE missives
     SET statut = 'programmee', programmee_le = COALESCE(p_quand, now())
   WHERE id = p_id AND statut IN ('brouillon', 'programmee') AND liste IS NOT NULL AND objet <> '';
  IF NOT FOUND THEN PERFORM _refus('Il faut une liste et un objet, et la Missive ne doit pas être partie', 'statut'); END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_enregistrer_missive(jsonb), public.hub_programmer_missive(bigint, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_enregistrer_missive(jsonb), public.hub_programmer_missive(bigint, timestamptz)
  TO authenticated;
