-- 192_defis_v2_action_tag.sql
-- Défis v2 : moteur action × tag, 3 viviers (jour / hebdo individuel / hebdo collectif).
-- 100% calcul-à-la-lecture + réclamation idempotente. AUCUN trigger (cf. incident 058).
-- Additif : ne touche pas aux RPCs daily v1 encore consommées par le front en prod.
--
-- Actions traçables : reveal (découverte remote), visit (découverte gps, sur place),
--   add (création de lieu), veilleur (plantage étendard GPS = place_veille by_influence=false),
--   enigma (tentative d'énigme).
-- Fenêtre : daily = jour courant ; weekly = semaine ISO courante (lundi).

-- ───────────────────────── Tables ─────────────────────────
CREATE TABLE IF NOT EXISTS public.defis (
  id            text PRIMARY KEY,
  cadence       text NOT NULL CHECK (cadence IN ('daily','weekly')),
  scope         text NOT NULL DEFAULT 'individual' CHECK (scope IN ('individual','collective')),
  action        text NOT NULL CHECK (action IN ('reveal','visit','add','veilleur','enigma')),
  tag_id        text,                 -- NULL = tous tags / sans objet (enigma)
  threshold     integer NOT NULL CHECK (threshold > 0),
  wording       text NOT NULL,
  icon          text NOT NULL DEFAULT '🗝️',
  reward_couronnes integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.defi_claims (
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  defi_id    text NOT NULL REFERENCES public.defis(id) ON DELETE CASCADE,
  period_key text NOT NULL,           -- 'YYYY-MM-DD' (daily) ou début de semaine (weekly)
  reward_couronnes integer NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, defi_id, period_key)
);

GRANT SELECT ON public.defis TO authenticated, anon;
GRANT SELECT ON public.defi_claims TO authenticated;

-- ───────────────── Helper : progression (action × tag × fenêtre) ─────────────────
-- p_collective = true → compte TOUS les joueurs (compteur communautaire) ; sinon le user.
CREATE OR REPLACE FUNCTION public._defi_progress(
  p_action text, p_tag_id text, p_user_id text, p_collective boolean, p_ws timestamptz
) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE n integer;
BEGIN
  IF p_action = 'enigma' THEN
    SELECT count(*) INTO n FROM public.enigma_responses e
     WHERE e.responded_at >= p_ws AND (p_collective OR e.user_id = p_user_id);
  ELSIF p_action IN ('reveal','visit') THEN
    SELECT count(*) INTO n FROM public.places_discovered pd
     WHERE pd.method = CASE p_action WHEN 'reveal' THEN 'remote' ELSE 'gps' END
       AND pd.discovered_at >= p_ws
       AND (p_collective OR pd.user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id));
  ELSIF p_action = 'add' THEN
    SELECT count(*) INTO n FROM public.places p
     WHERE p.created_at >= p_ws
       AND (p_collective OR p.author_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id));
  ELSIF p_action = 'veilleur' THEN
    SELECT count(*) INTO n FROM public.place_veille pv
     WHERE pv.by_influence = false AND pv.planted_at >= p_ws
       AND (p_collective OR pv.veilleur_user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = p_tag_id));
  ELSE
    n := 0;
  END IF;
  RETURN COALESCE(n, 0);
END; $$;

-- ───────────────── Helpers fenêtre + tirage déterministe ─────────────────
CREATE OR REPLACE FUNCTION public._defi_window_start(p_cadence text) RETURNS timestamptz
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_cadence = 'weekly'
              THEN date_trunc('week', now())
              ELSE current_date::timestamptz END;
$$;

CREATE OR REPLACE FUNCTION public._defi_period_key(p_cadence text) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_cadence = 'weekly'
              THEN to_char(date_trunc('week', now()), 'IYYY-"W"IW')
              ELSE to_char(current_date, 'YYYY-MM-DD') END;
$$;

-- Tire 1 défi actif d'un vivier (cadence+scope), déterministe sur la période.
CREATE OR REPLACE FUNCTION public._pick_defi(p_cadence text, p_scope text) RETURNS public.defis
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.defis; v_seed bigint;
BEGIN
  v_seed := ('x' || md5(public._defi_period_key(p_cadence)))::bit(32)::bigint;
  SELECT * INTO v FROM public.defis
   WHERE active AND cadence = p_cadence AND scope = p_scope
   ORDER BY ((display_order * 2654435761) # v_seed)
   LIMIT 1;
  RETURN v;
END; $$;

-- ───────────────── RPC : état du tableau de défis ─────────────────
CREATE OR REPLACE FUNCTION public.get_defis_board(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> v_uid THEN RETURN '{}'::json; END IF;

  WITH picks AS (
    SELECT 'daily'::text k, (public._pick_defi('daily','individual')).*
    UNION ALL SELECT 'weeklyIndividual', (public._pick_defi('weekly','individual')).*
    UNION ALL SELECT 'weeklyCollective', (public._pick_defi('weekly','collective')).*
  )
  SELECT json_object_agg(k, CASE WHEN id IS NULL THEN NULL ELSE json_build_object(
    'id', id, 'action', action, 'scope', scope, 'cadence', cadence,
    'title', wording, 'icon', icon, 'tagId', tag_id,
    'target', threshold,
    'reward', reward_couronnes,
    'progress', LEAST(public._defi_progress(action, tag_id, v_uid, (scope='collective'),
                        public._defi_window_start(cadence)), threshold),
    'myContribution', public._defi_progress(action, tag_id, v_uid, false, public._defi_window_start(cadence)),
    'claimed', EXISTS (SELECT 1 FROM public.defi_claims dc
                        WHERE dc.user_id = v_uid AND dc.defi_id = id
                          AND dc.period_key = public._defi_period_key(cadence))
  ) END) INTO v FROM picks;

  RETURN COALESCE(v, '{}'::json);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_defis_board(text) TO authenticated, service_role;

-- ───────────────── RPC : réclamation idempotente du butin ─────────────────
CREATE OR REPLACE FUNCTION public.claim_defi(p_defi_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  d public.defis;
  v_ws timestamptz; v_pk text; v_global int; v_mine int; v_rows int;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth_required'); END IF;
  SELECT * INTO d FROM public.defis WHERE id = p_defi_id AND active;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'defi_not_found'); END IF;

  v_ws := public._defi_window_start(d.cadence);
  v_pk := public._defi_period_key(d.cadence);
  v_mine := public._defi_progress(d.action, d.tag_id, v_uid, false, v_ws);

  IF d.scope = 'collective' THEN
    v_global := public._defi_progress(d.action, d.tag_id, NULL, true, v_ws);
    IF v_global < d.threshold OR v_mine < 1 THEN
      RETURN json_build_object('ok', false, 'error', 'not_eligible'); END IF;
  ELSE
    IF v_mine < d.threshold THEN
      RETURN json_build_object('ok', false, 'error', 'not_complete'); END IF;
  END IF;

  INSERT INTO public.defi_claims (user_id, defi_id, period_key, reward_couronnes)
    VALUES (v_uid, d.id, v_pk, d.reward_couronnes) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN json_build_object('ok', true, 'alreadyClaimed', true); END IF;

  IF d.reward_couronnes > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_uid, LEAST(500, d.reward_couronnes), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + d.reward_couronnes), updated_at = now();
  END IF;

  RETURN json_build_object('ok', true, 'alreadyClaimed', false,
    'icon', d.icon, 'title', d.wording,
    'reward', json_build_object('crowns', d.reward_couronnes));
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_defi(text) TO authenticated;

-- ───────────────── Seed des 40 défis ─────────────────
-- tags : 3fQyu5KCU=Châteaux _cjvj91BX=Cathédrales WC51eGlMy=Sources EaeTGcHV2=Dolmens
--   DwlWijqgg=Ruines zWGn-Bles=Monuments 5yOutD8Lp=Monts uileM8JGQ=Sanctuaires
--   4zC0EoxJr=Arbres maîtres qFgH3VtCz=Temples esgo0rr1G=Statues Jvo33GomD75u41Q3y8ox=Historique
--   panoramique=Vue emblématique 3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402=Grottes
INSERT INTO public.defis (id, cadence, scope, action, tag_id, threshold, wording, icon, reward_couronnes, display_order) VALUES
-- DÉFI DU JOUR (reveal / enigma)
('d_rev_chateau','daily','individual','reveal','3fQyu5KCU',1,'Révèle un château ou un fortin','🏰',3,10),
('d_rev_cathedrale','daily','individual','reveal','_cjvj91BX',1,'Lève le brouillard sur une cathédrale','⛪',3,11),
('d_rev_megalithe','daily','individual','reveal','EaeTGcHV2',2,'Révèle 2 dolmens ou mégalithes','🪨',4,12),
('d_rev_monument','daily','individual','reveal','zWGn-Bles',1,'Dévoile un monument','🗿',3,13),
('d_rev_source','daily','individual','reveal','WC51eGlMy',1,'Révèle une source, un lac ou une rivière','💧',3,14),
('d_rev_ruines','daily','individual','reveal','DwlWijqgg',1,'Révèle des ruines ou des vestiges','🏚️',3,15),
('d_rev_arbre','daily','individual','reveal','4zC0EoxJr',1,'Révèle un arbre maître','🌳',4,16),
('d_rev_mont','daily','individual','reveal','5yOutD8Lp',1,'Repère un mont ou un promontoire','⛰️',3,17),
('d_rev_sanctuaire','daily','individual','reveal','uileM8JGQ',1,'Dévoile un sanctuaire','🛕',3,18),
('d_rev_temple','daily','individual','reveal','qFgH3VtCz',1,'Révèle un temple ancien','🏛️',4,19),
('d_rev_statue','daily','individual','reveal','esgo0rr1G',1,'Révèle une statue','🗼',3,20),
('d_rev_grotte','daily','individual','reveal','3e4eaf68-a0fd-4e0e-987c-e59fc2f2b402',1,'Révèle une grotte ou un cairn','🕳️',4,21),
('d_rev_historique','daily','individual','reveal','Jvo33GomD75u41Q3y8ox',1,'Révèle un lieu historique','📜',3,22),
('d_enigme','daily','individual','enigma',NULL,1,'Affronte l''énigme du jour','🗝️',3,23),
-- HEBDO INDIVIDUEL (visit / veilleur / add)
('w_visit_chateau','weekly','individual','visit','3fQyu5KCU',1,'Visite un château ou un fortin','🏰',12,30),
('w_visit_cathedrale','weekly','individual','visit','_cjvj91BX',1,'Visite une cathédrale ou une basilique','⛪',12,31),
('w_visit_dolmen','weekly','individual','visit','EaeTGcHV2',1,'Visite un dolmen ou un mégalithe','🪨',12,32),
('w_visit_mont','weekly','individual','visit','5yOutD8Lp',1,'Gravis un mont ou un promontoire','⛰️',14,33),
('w_visit_arbre','weekly','individual','visit','4zC0EoxJr',1,'Recueille-toi sous un arbre maître','🌳',13,34),
('w_visit_source','weekly','individual','visit','WC51eGlMy',1,'Visite une source, un lac ou une rivière','💧',10,35),
('w_visit_ruines','weekly','individual','visit','DwlWijqgg',1,'Explore des ruines ou des vestiges','🏚️',10,36),
('w_visit_sanctuaire','weekly','individual','visit','uileM8JGQ',1,'Visite un sanctuaire','🛕',11,37),
('w_veille_chateau','weekly','individual','veilleur','3fQyu5KCU',1,'Plante ton étendard sur un château','⚔️',11,38),
('w_veille_cathedrale','weekly','individual','veilleur','_cjvj91BX',1,'Deviens le veilleur d''une cathédrale','⛪',11,39),
('w_veille_dolmen','weekly','individual','veilleur','EaeTGcHV2',1,'Deviens le gardien d''un dolmen','🗿',10,40),
('w_veille_temple','weekly','individual','veilleur','qFgH3VtCz',1,'Veille sur un temple ancien','🏛️',11,41),
('w_add_chateau','weekly','individual','add','3fQyu5KCU',1,'Ajoute un château à la carte','🛠️',9,42),
('w_add_source','weekly','individual','add','WC51eGlMy',1,'Cartographie une source, un lac ou une rivière','💧',8,43),
('w_add_megalithe','weekly','individual','add','EaeTGcHV2',1,'Inscris un mégalithe oublié','🪨',9,44),
('w_add_vue','weekly','individual','add','panoramique',1,'Ajoute une vue emblématique','🌄',8,45),
-- HEBDO COLLECTIF (compteur partagé, à thème)
('c_add_chateau','weekly','collective','add','3fQyu5KCU',10,'La communauté ajoute 10 châteaux','🏰',12,50),
('c_veille_arbre','weekly','collective','veilleur','4zC0EoxJr',7,'La communauté veille sur 7 arbres maîtres','🌳',15,51),
('c_visit_cathedrale','weekly','collective','visit','_cjvj91BX',20,'La communauté visite 20 cathédrales','⛪',14,52),
('c_add_source','weekly','collective','add','WC51eGlMy',12,'La communauté cartographie 12 sources, lacs ou rivières','💧',12,53),
('c_rev_megalithe','weekly','collective','reveal','EaeTGcHV2',25,'La communauté révèle 25 mégalithes','🪨',10,54),
('c_visit_mont','weekly','collective','visit','5yOutD8Lp',15,'La communauté gravit 15 monts','⛰️',15,55),
('c_veille_chateau','weekly','collective','veilleur','3fQyu5KCU',30,'La communauté plante 30 étendards sur des châteaux','⚔️',12,56),
('c_veille_sanctuaire','weekly','collective','veilleur','uileM8JGQ',10,'La communauté veille sur 10 sanctuaires','🛕',13,57),
('c_visit_ruines','weekly','collective','visit','DwlWijqgg',20,'La communauté explore 20 ruines','🏚️',12,58),
('c_rev_monument','weekly','collective','reveal','zWGn-Bles',15,'La communauté recense 15 monuments','🗿',11,59)
ON CONFLICT (id) DO UPDATE SET
  cadence=EXCLUDED.cadence, scope=EXCLUDED.scope, action=EXCLUDED.action, tag_id=EXCLUDED.tag_id,
  threshold=EXCLUDED.threshold, wording=EXCLUDED.wording, icon=EXCLUDED.icon,
  reward_couronnes=EXCLUDED.reward_couronnes, display_order=EXCLUDED.display_order, active=true;
