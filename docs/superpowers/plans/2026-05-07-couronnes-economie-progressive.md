# Couronnes — Économie progressive : Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre l'économie Couronnes en système progressif : tirage indépendant par lieu (proba dégressive), drip intra-journée, baseline universel pour les "0 lieu" (énigmes existantes + découverte de lieu + mini-quête).

**Architecture:** SQL-first. 3 migrations séquentielles : (121) seed `app_settings`, (122) refonte `get_my_crowns_state` + `harvest_crown`, (123) extension `discover_place` pour le gain découverte + bonus mini-quête. Côté front, ajustement minimal du toast de découverte pour annoncer le gain Couronne. Tests manuels via `pnpm dlx supabase db query` post-migration.

**Tech Stack:** Postgres / Supabase RPCs PL/pgSQL · TypeScript / React (explore-web) · `app_settings` table (pattern existant)

**Spec source :** `docs/superpowers/specs/2026-05-07-couronnes-economie-progressive-design.md`

**Discipline appliquée (xo-discipline.md) :**
- B1 : redéfinir une RPC = copier-coller la baseline ENTIÈRE puis modifier
- B4 : commenter en tête de migration le POURQUOI
- B5 : appliquer les migs soi-même via `pnpm dlx supabase db push`
- E1 : build OK obligatoire avant push
- E4 : push par lots cohérents (1 phase = 1 lot)

**Placeholders runtime :** les chaînes `<URIEL_USER_ID>` et `<TEST_PLACE_ID>` qui apparaissent dans les smoke tests sont des **variables à substituer à l'exécution** (avec un vrai user_id et un vrai place_id du compte test Uriel — disponibles via `pnpm dlx supabase db query "SELECT id FROM users WHERE email_address = 'thenorthwanderers@gmail.com';"` et `SELECT pv.place_id FROM place_veille pv JOIN expedition_members em ON em.expedition_id = pv.expedition_id WHERE em.user_id = '<URIEL_USER_ID>' LIMIT 1`). Pas des placeholders de design.

---

## Phase 1 — Patrimoine progressif (refonte moteur)

**But de la phase :** remplacer le cap fixe 15/jour (mig 029) par tirage indépendant par lieu + drip intra-journée + paramétrage `app_settings`. Phase autosuffisante : ship-able sans Phase 2.

### Task 1.1 : Créer mig 121 — seed `app_settings`

**Files:**
- Create: `supabase/migrations/121_app_settings_crowns_seeds.sql`

**Why first:** la mig 122 lit ces clés. Si elles n'existent pas, les `COALESCE(... , <défaut>)` couvrent, mais un seed explicite documente l'intention et permet de modifier à chaud sans crainte.

- [ ] **Step 1 : Écrire la migration**

```sql
-- 121_app_settings_crowns_seeds.sql
-- WHY : Phase 1 du nouveau système Couronnes (spec 2026-05-07).
-- On externalise les constantes de l'éco Couronnes vers app_settings pour pouvoir
-- les ajuster à chaud sans nouvelle migration. La mig 122 (refonte
-- get_my_crowns_state) lit ces clés via COALESCE — donc valeurs par défaut
-- protégées si la clé manque, mais on seed explicitement pour documenter.

BEGIN;

INSERT INTO public.app_settings (key, value) VALUES
  ('crowns_proba_k',                  '3.87'),  -- p(N) = K / sqrt(N) ; K=sqrt(15) → p(15)=1.0
  ('crowns_proba_n_floor',            '15'),    -- N ≤ ce seuil → 100% (tous les coffres visibles)
  ('crowns_drip_start_hour',          '6'),     -- heure de début d'apparition (HH:00 local server)
  ('crowns_drip_end_hour',            '20'),    -- heure de fin d'apparition (tout dispo après)
  ('crowns_stock_cap',                '500'),   -- plafond de stock (= valeur actuelle dans harvest_crown)
  ('crowns_discovery_gain',           '1'),     -- gain par découverte 1ère visite GPS
  ('crowns_quest_discover_threshold', '3'),     -- nombre de découvertes pour la mini-quête
  ('crowns_quest_discover_bonus',     '1')      -- bonus de la mini-quête
ON CONFLICT (key) DO NOTHING;

COMMIT;
```

- [ ] **Step 2 : Apply localement**

```powershell
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase db push
```
Expected: `Applying migration 121_app_settings_crowns_seeds.sql... Finished supabase db push.`

- [ ] **Step 3 : Smoke test — vérifier les 8 clés**

```powershell
pnpm dlx supabase db query "SELECT key, value FROM app_settings WHERE key LIKE 'crowns_%' ORDER BY key;"
```
Expected: 8 lignes, valeurs ci-dessus.

- [ ] **Step 4 : Commit (pas de push immédiat — fin de phase)**

```bash
git add supabase/migrations/121_app_settings_crowns_seeds.sql
git commit -m "feat(crowns): seed app_settings pour économie progressive (mig 121)"
```

---

### Task 1.2 : Mig 122 — refonte `get_my_crowns_state` + `harvest_crown`

**Files:**
- Create: `supabase/migrations/122_crowns_progressive.sql`

**Baseline source (à copier-coller selon B1) :** mig 029 (`get_my_crowns_state` et `harvest_crown` actuelles).

- [ ] **Step 1 : Écrire la migration complète**

```sql
-- 122_crowns_progressive.sql
-- WHY : refonte de l'éco Couronnes (spec 2026-05-07).
-- Avant : cap silencieux fixe 15 coffres/jour, set sélectionné par md5
-- (mig 029) — frustrait les "0 lieu" et trivialisait les gros bâtisseurs.
-- Après : tirage indépendant par lieu, proba dégressive p(N) = K/sqrt(N),
-- drip intra-journée (6h-20h), paramétré app_settings.
--
-- Reprise EXACTE de la mig 029 puis modifications ciblées :
--   1) get_my_crowns_state : remplace today_set (LIMIT 15) par tirage par lieu
--      + filtre drip_minute <= now()
--   2) harvest_crown : remplace check today_set par re-évaluation du tirage
--      (cohérent avec ce que voit le frontend) + check drip
--
-- Côté front, aucun changement de signature : payload identique.

BEGIN;

-- ============================================================
-- _crown_proba_for_n : helper qui calcule p(N) lu depuis app_settings
-- ============================================================

CREATE OR REPLACE FUNCTION public._crown_proba_for_n(p_n integer)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_k       numeric;
  v_floor_n integer;
BEGIN
  v_k       := COALESCE((SELECT value::numeric FROM public.app_settings WHERE key = 'crowns_proba_k'),       3.87);
  v_floor_n := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_proba_n_floor'), 15);

  IF p_n <= 0 THEN RETURN 0; END IF;
  IF p_n <= v_floor_n THEN RETURN 1.0; END IF;
  RETURN LEAST(1.0, v_k / sqrt(p_n));
END;
$$;

GRANT EXECUTE ON FUNCTION public._crown_proba_for_n(integer) TO authenticated, service_role;

-- ============================================================
-- _crown_eligible_today : helper booléen — ce lieu a-t-il un coffre
-- aujourd'hui pour ce user, et est-il déjà apparu (drip) ?
-- Stateless, déterministe via md5(user || place || date).
-- ============================================================

CREATE OR REPLACE FUNCTION public._crown_eligible_today(
  p_user_id  text,
  p_place_id text,
  p_n_total  integer
) RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_h            text;
  v_proba_int    integer;
  v_proba        numeric;
  v_h_lo         text;
  v_h_hi         integer;
  v_drip_minute  integer;
  v_now_minute   integer;
  v_drip_h0      integer;
  v_drip_h1      integer;
  v_drip_window  integer;
BEGIN
  v_h := md5(p_user_id || '-' || p_place_id || '-' || current_date::text);

  -- Tirage proba par lieu : convertir 8 premiers chars hex (32 bits) en bigint
  -- puis abs() avant le modulo (le cast bit(32)::bigint donne un signed → la
  -- moitié des hashes seraient négatifs et tomberaient jamais dans le seuil).
  v_h_lo := substr(v_h, 1, 8);
  v_proba := public._crown_proba_for_n(p_n_total);
  v_proba_int := (FLOOR(v_proba * 1000))::integer;
  IF (abs(('x' || v_h_lo)::bit(32)::bigint) % 1000) >= v_proba_int THEN
    RETURN false;
  END IF;

  -- Drip : minute d'apparition entre crowns_drip_start_hour et crowns_drip_end_hour
  v_drip_h0     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_drip_start_hour'), 6);
  v_drip_h1     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_drip_end_hour'),   20);
  v_drip_window := GREATEST(60, (v_drip_h1 - v_drip_h0) * 60);  -- safety floor 60 min

  v_h_hi := (abs(('x' || substr(v_h, 9, 8))::bit(32)::bigint) % v_drip_window)::integer;
  v_drip_minute := v_drip_h0 * 60 + v_h_hi;

  v_now_minute := EXTRACT(HOUR FROM now())::integer * 60 + EXTRACT(MINUTE FROM now())::integer;
  RETURN v_drip_minute <= v_now_minute;
END;
$$;

GRANT EXECUTE ON FUNCTION public._crown_eligible_today(text, text, integer) TO authenticated, service_role;

-- ============================================================
-- get_my_crowns_state — refonte sur tirage par lieu
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_crowns_state(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_balance   integer;
  v_cap       integer;
  v_capped    boolean;
  v_now       timestamptz := now();
  v_n_total   integer;
  v_items     jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('balance', 0, 'capped', false, 'harvestable', '[]'::jsonb);
  END IF;

  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);
  v_cap     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'), 500);
  v_capped  := v_balance >= v_cap;

  IF v_capped THEN
    RETURN json_build_object('balance', v_balance, 'capped', true, 'harvestable', '[]'::jsonb);
  END IF;

  -- N = nombre total de lieux veillés par le user (denominator de la proba)
  SELECT count(*)::integer INTO v_n_total
  FROM public.place_veille pv
  JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id;

  -- Pour chaque lieu : tirage proba + drip + cooldown 24h.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'placeId',    t.place_id,
    'gain',       t.gain,
    'eligibleAt', t.eligible_at
  )), '[]'::jsonb) INTO v_items
  FROM (
    SELECT
      pv.place_id,
      CASE WHEN (
        SELECT count(*) FROM public.expedition_members em2
        WHERE em2.expedition_id = pv.expedition_id
      ) >= 2 THEN 2 ELSE 1 END                                                     AS gain,
      COALESCE(ch.last_harvested_at, pv.planted_at) + interval '24 hours'          AS eligible_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    LEFT JOIN public.crown_harvest ch ON ch.place_id = pv.place_id AND ch.user_id = p_user_id
    WHERE
      public._crown_eligible_today(p_user_id, pv.place_id, v_n_total) = true
      AND COALESCE(ch.last_harvested_at, pv.planted_at) + interval '24 hours' <= v_now
  ) t;

  RETURN json_build_object(
    'balance',     v_balance,
    'capped',      false,
    'harvestable', v_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_crowns_state(text) TO authenticated, service_role;

-- ============================================================
-- harvest_crown — re-vérifie le tirage du jour (anti-bypass)
-- Reprise exacte mig 029 sauf le bloc de check, remplacé par appel
-- au helper _crown_eligible_today (cohérent avec ce que voit le front).
-- ============================================================

CREATE OR REPLACE FUNCTION public.harvest_crown(
  p_user_id  text,
  p_place_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now              timestamptz := now();
  v_eligible         boolean;
  v_expedition_id    uuid;
  v_planted_at       timestamptz;
  v_member_count     integer;
  v_is_member        boolean;
  v_last_harvested   timestamptz;
  v_eligible_at      timestamptz;
  v_gain             integer;
  v_current_balance  integer;
  v_new_balance      integer;
  v_cap              integer;
  v_n_total          integer;
  v_place_title      text;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Anti-bypass : recalcul du tirage du jour côté serveur.
  -- Le user doit être dans une expé sur ce lieu pour que N inclue le lieu.
  SELECT count(*)::integer INTO v_n_total
  FROM public.place_veille pv
  JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id;

  v_eligible := public._crown_eligible_today(p_user_id, p_place_id, v_n_total);
  IF NOT v_eligible THEN
    RETURN json_build_object('error', 'not_today');
  END IF;

  SELECT pv.expedition_id, pv.planted_at INTO v_expedition_id, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_expedition_id IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  SELECT
    bool_or(em.user_id = p_user_id),
    count(*)::integer
  INTO v_is_member, v_member_count
  FROM public.expedition_members em
  WHERE em.expedition_id = v_expedition_id;

  IF NOT COALESCE(v_is_member, false) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  SELECT ch.last_harvested_at INTO v_last_harvested
  FROM public.crown_harvest ch
  WHERE ch.place_id = p_place_id AND ch.user_id = p_user_id;

  v_eligible_at := COALESCE(v_last_harvested, v_planted_at) + interval '24 hours';

  IF v_now < v_eligible_at THEN
    RETURN json_build_object('error', 'too_soon', 'eligibleAt', v_eligible_at);
  END IF;

  v_cap := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'), 500);
  SELECT balance INTO v_current_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_current_balance := COALESCE(v_current_balance, 0);

  IF v_current_balance >= v_cap THEN
    RETURN json_build_object('error', 'stock_full', 'balance', v_current_balance);
  END IF;

  v_gain := CASE WHEN v_member_count >= 2 THEN 2 ELSE 1 END;
  v_new_balance := LEAST(v_cap, v_current_balance + v_gain);

  INSERT INTO public.user_crowns (user_id, balance, updated_at)
  VALUES (p_user_id, v_new_balance, v_now)
  ON CONFLICT (user_id) DO UPDATE SET
    balance    = EXCLUDED.balance,
    updated_at = EXCLUDED.updated_at;

  INSERT INTO public.crown_harvest (place_id, user_id, last_harvested_at)
  VALUES (p_place_id, p_user_id, v_now)
  ON CONFLICT (place_id, user_id) DO UPDATE SET
    last_harvested_at = EXCLUDED.last_harvested_at;

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES (
    'harvest_crown', p_user_id, p_place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'gain', v_gain,
      'memberCount', v_member_count,
      'newBalance', v_new_balance
    )
  );

  RETURN json_build_object(
    'success',     true,
    'placeId',     p_place_id,
    'gain',        v_gain,
    'balance',     v_new_balance,
    'harvestedAt', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.harvest_crown(text, text) TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Apply en remote**

```powershell
pnpm dlx supabase db push
```
Expected: `Applying migration 122_crowns_progressive.sql... Finished supabase db push.`

- [ ] **Step 3 : Smoke test — helper proba**

```powershell
pnpm dlx supabase db query "SELECT public._crown_proba_for_n(0)::text   AS p_0,   public._crown_proba_for_n(15)::text  AS p_15,  public._crown_proba_for_n(50)::text  AS p_50,  public._crown_proba_for_n(100)::text AS p_100, public._crown_proba_for_n(400)::text AS p_400;"
```
Expected:
- p_0   ≈ 0
- p_15  = 1.0
- p_50  ≈ 0.547
- p_100 ≈ 0.387
- p_400 ≈ 0.1935

- [ ] **Step 4 : Smoke test — helper eligible_today (avec un placeId test)**

Choisir un user_id test (Uriel) et un placeId qu'il a veillé. Lancer 5 fois pour confirmer **idempotence intra-journée** (même résultat) :

```powershell
pnpm dlx supabase db query "SELECT public._crown_eligible_today('<URIEL_USER_ID>', '<TEST_PLACE_ID>', 50)::text AS eligible_now;"
```
Expected: même valeur boolean à chaque run.

- [ ] **Step 5 : Smoke test — get_my_crowns_state pour Uriel**

```powershell
pnpm dlx supabase db query "SELECT public.get_my_crowns_state('<URIEL_USER_ID>')::text;"
```
Expected: JSON valide avec `balance` cohérent, `capped` false (sauf si plein), `harvestable` array de N items où N varie selon l'heure (drip) et le tirage du jour.

- [ ] **Step 6 : Smoke test — harvest_crown invalide doit échouer**

```powershell
pnpm dlx supabase db query "SELECT public.harvest_crown('<URIEL_USER_ID>', 'place_qui_nexiste_pas')::text;"
```
Expected: JSON contenant `"error": "not_today"`.

- [ ] **Step 7 : Build front (cohérence — la signature n'a pas changé mais on vérifie qu'aucun TS strict ne casse)**

```powershell
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm build
```
Expected: build OK en ~5s, pas d'erreur TS.

- [ ] **Step 8 : Test manuel UI — récolter quelques coffres**

1. Ouvrir `pnpm dev` depuis `apps/explore-web`
2. Login avec compte test Uriel
3. Observer le compteur Couronnes au header
4. Aller sur la carte, vérifier la présence de coffres sur les lieux veillés
5. Cliquer sur un coffre → animation + balance qui monte
6. Recharger la page → le coffre récolté n'est plus là, balance persistée

- [ ] **Step 9 : Commit**

```bash
git add supabase/migrations/122_crowns_progressive.sql
git commit -m "feat(crowns): refonte progressive (tirage par lieu + drip) — mig 122"
```

---

### Task 1.3 : Push de la Phase 1

- [ ] **Step 1 : Push**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
git push origin main
```

- [ ] **Step 2 : Deploy front en prod si on veut le rendre dispo aux users tout de suite**

```powershell
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm dlx netlify deploy --prod --dir="C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web/dist"
```

> **Note :** côté front, aucun changement de code n'a été nécessaire en Phase 1 (signature des RPCs identique). Le rebuild + deploy est optionnel ici, on peut l'attendre pour la Phase 2 et grouper.

---

## Phase 2 — Source découverte + mini-quête

**But de la phase :** que les "0 lieu" et tout joueur qui découvre des lieux gagnent des Couronnes. Étend `discover_place` pour créditer +1 Couronne par 1ère visite GPS, et un bonus +1 si c'est la 3e découverte du jour (mini-quête déclenchée automatiquement).

### Task 2.1 : Créer mig 123 — `discover_place` étendue + bonus mini-quête

**Files:**
- Create: `supabase/migrations/123_crowns_discovery_quest.sql`

**Baseline source (B1) :** mig 087 — c'est la dernière version de `discover_place`. Le code ci-dessous reprend mig 087 verbatim et insère un bloc V123 entre la mise à jour de `exploration_points` et le RETURN JSON.

- [ ] **Step 1 : Écrire la migration complète**

```sql
-- 123_crowns_discovery_quest.sql
-- WHY : Phase 2 du nouveau système Couronnes (spec 2026-05-07).
-- Donne aux "0 lieu" une source active de Couronnes.
--   - +1 Couronne par découverte 1ère visite GPS (p_method = 'gps' ET insertion
--     effective dans places_discovered, c.-à-d. pas un re-discover bloqué).
--   - +1 bonus mini-quête "Découvre 3 lieux" à la 3e découverte GPS du jour,
--     dédupliqué via activity_log (type='crown_quest_discovery').
--
-- Reprise EXACTE de discover_place mig 087 — seul ajout : le bloc V123 entre
-- la mise à jour de exploration_points et le RETURN JSON. Plus 3 champs au
-- retour JSON ('crownsGain', 'questBonus', 'newCrownsBalance' — additifs, le
-- frontend qui ignore ces clés continue de marcher).
--
-- Le tracking utilise places_discovered (1 row par couple user/place, colonne
-- discovered_at DEFAULT now()) et NON place_explorers ni places_explored. La
-- mini-quête compte donc les découvertes uniques du jour, pas les visites.

BEGIN;

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id    text,
  p_place_id   text,
  p_method     text DEFAULT 'remote',
  p_user_lat   numeric DEFAULT NULL,
  p_user_lng   numeric DEFAULT NULL,
  p_free       boolean DEFAULT false,
  p_glory_mult numeric DEFAULT 1
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_exploration_gain INT;
  v_gps_bonus INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_m NUMERIC;
  v_method TEXT;
  v_proximity_m NUMERIC := 500;
  -- V123 : variables Couronnes
  v_crowns_gain          integer := 0;
  v_quest_bonus          integer := 0;
  v_new_crowns_balance   integer := 0;
  v_discoveries_today    integer;
  v_quest_threshold      integer;
  v_quest_already_done   boolean;
  v_crowns_cap           integer;
  v_discovery_gain_cfg   integer;
  v_quest_bonus_cfg      integer;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_method := 'remote';
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_m := 6371000 * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(v_place_lat - p_user_lat) / 2), 2) +
      COS(RADIANS(p_user_lat)) * COS(RADIANS(v_place_lat)) *
      POWER(SIN(RADIANS(v_place_lng - p_user_lng) / 2), 2)
    ));
    IF v_distance_m <= v_proximity_m THEN
      v_method := 'gps';
    END IF;
  END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF v_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, v_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  IF v_method = 'gps' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_gps_bonus'), 10) INTO v_gps_bonus;
    v_exploration_gain := v_gps_bonus;
  ELSE
    v_exploration_gain := 1;
  END IF;

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  -- ───── V123 : Couronnes par découverte GPS + bonus mini-quête ─────
  IF v_method = 'gps' THEN
    v_crowns_cap         := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_stock_cap'),                  500);
    v_discovery_gain_cfg := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_discovery_gain'),               1);
    v_quest_bonus_cfg    := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_bonus'),         1);
    v_quest_threshold    := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'crowns_quest_discover_threshold'),     3);

    v_crowns_gain := v_discovery_gain_cfg;

    -- Compter les découvertes GPS du jour (incluant celle qu'on vient d'insérer).
    SELECT count(*)::integer INTO v_discoveries_today
    FROM public.places_discovered
    WHERE user_id = p_user_id
      AND method = 'gps'
      AND discovered_at::date = current_date;

    SELECT EXISTS(
      SELECT 1 FROM public.activity_log
      WHERE actor_id = p_user_id
        AND type     = 'crown_quest_discovery'
        AND created_at::date = current_date
    ) INTO v_quest_already_done;

    IF v_discoveries_today >= v_quest_threshold AND NOT v_quest_already_done THEN
      v_quest_bonus := v_quest_bonus_cfg;
    END IF;

    IF (v_crowns_gain + v_quest_bonus) > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (p_user_id, LEAST(v_crowns_cap, v_crowns_gain + v_quest_bonus), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance    = LEAST(v_crowns_cap, public.user_crowns.balance + v_crowns_gain + v_quest_bonus),
        updated_at = now()
      RETURNING balance INTO v_new_crowns_balance;
    ELSE
      SELECT COALESCE(balance, 0) INTO v_new_crowns_balance FROM public.user_crowns WHERE user_id = p_user_id;
      v_new_crowns_balance := COALESCE(v_new_crowns_balance, 0);
    END IF;

    IF v_quest_bonus > 0 THEN
      INSERT INTO public.activity_log (type, actor_id, data)
      VALUES ('crown_quest_discovery', p_user_id, jsonb_build_object(
        'discoveriesCount', v_discoveries_today,
        'bonusGain',        v_quest_bonus,
        'newBalance',       v_new_crowns_balance
      ));
    END IF;
  END IF;
  -- ───── FIN V123 ─────

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0,
    'crownsGain',       v_crowns_gain,
    'questBonus',       v_quest_bonus,
    'newCrownsBalance', v_new_crowns_balance
  );
END;
$$;

GRANT ALL ON FUNCTION public.discover_place(text, text, text, numeric, numeric, boolean, numeric)
  TO anon, authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Apply**

```powershell
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase db push
```
Expected: `Applying migration 123_crowns_discovery_quest.sql... Finished supabase db push.`

- [ ] **Step 3 : Smoke test — paramétrage en place**

```powershell
pnpm dlx supabase db query "SELECT key, value FROM app_settings WHERE key IN ('crowns_discovery_gain','crowns_quest_discover_threshold','crowns_quest_discover_bonus');"
```
Expected: 3 lignes, valeurs 1 / 3 / 1.

- [ ] **Step 4 : Test manuel — découvrir un nouveau lieu en GPS**

1. Avec compte test, atteindre un lieu non encore découvert en mode GPS (proximité < 500m → simulable en dev en spoofant la position via DevTools)
2. Cliquer "Poser ma marque"
3. Vérifier le balance Couronnes monte de +1
4. Vérifier que la balance Couronnes monte (le toast lui-même n'est branché qu'à Task 2.2 — ici on valide juste la mécanique SQL via `SELECT balance FROM user_crowns WHERE user_id = ...`)

- [ ] **Step 5 : Test manuel — déclencher la mini-quête**

1. Découvrir 3 lieux GPS dans la même journée
2. À la 3e découverte : balance doit monter de +2 (1 découverte + 1 bonus quête)
3. Vérifier `activity_log` :
```powershell
pnpm dlx supabase db query "SELECT type, data FROM activity_log WHERE actor_id='<URIEL_USER_ID>' AND type='crown_quest_discovery' AND created_at::date = current_date;"
```
Expected: 1 ligne avec `discoveriesCount: 3`, `bonusGain: 1`.

4. Découvrir un 4e lieu : balance monte seulement de +1 (pas de re-bonus)

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/123_crowns_discovery_quest.sql
git commit -m "feat(crowns): gain découverte + mini-quête (mig 123)"
```

---

### Task 2.2 : Front — étendre toast de découverte avec gain Couronne

**Files:**
- Modify: `apps/explore-web/src/lib/discoverPlace.ts`

**Why :** la RPC `discover_place` renvoie maintenant `crownsGain` et `questBonus`. Le toast actuel n'annonce que Gloire/Coupe. On enrichit pour annoncer aussi la Couronne (et le bonus si déclenché).

- [ ] **Step 1 : Modifier le bloc toast dans `discoverPlace.ts`**

Localiser le bloc qui construit `toastMessage` (lignes ~83-97 dans la version courante) et l'étendre :

```typescript
// V067 — barème centralisé app_settings via gloryRulesStore.
// Découverte = +discover_remote G / +discover_remote C (par défaut 1G / 0C).
const rules = useGloryRulesStore.getState().rules
const gloryGain = rules['glory.discover_remote'] ?? 1
const coupeGain = rules['coupe.discover_remote'] ?? 0
const crownsGain = (data?.crownsGain ?? 0) + (data?.questBonus ?? 0)

const gainParts: string[] = []
if (gloryGain > 0) gainParts.push(`+${gloryGain} Gloire`)
if (coupeGain > 0) gainParts.push(`+${coupeGain} Coupe`)
if (crownsGain > 0) {
  const questSuffix = (data?.questBonus ?? 0) > 0 ? ' (Mini-quête !)' : ''
  gainParts.push(`+${crownsGain} 👑${questSuffix}`)
}
const toastMessage = `Le brouillard se lève sur ce lieu 🔍 ${gainParts.join(' / ')}`
```

- [ ] **Step 2 : Refresh balance Couronnes côté store après découverte**

Toujours dans `discoverPlace.ts`, après le bloc qui rafraîchit l'énergie, ajouter le refresh du store Couronnes :

```typescript
// V0.7+ — refresh balance Couronnes après découverte (gain potentiel + bonus quête)
if ((data?.crownsGain ?? 0) > 0 || (data?.questBonus ?? 0) > 0) {
  const { useCrownsStore } = await import('../stores/crownsStore')
  useCrownsStore.getState().setBalance(data.newCrownsBalance ?? 0)
}
```

> Pourquoi `import` dynamique : éviter un import circulaire potentiel ; `discoverPlace.ts` est déjà chargé tôt dans le boot et le store crowns ne devrait pas dépendre de discoverPlace, donc en pratique un `import` static fonctionne. Préférer le static si pas de cycle (vérifier au build).

- [ ] **Step 3 : Build**

```powershell
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm build
```
Expected: build OK, pas d'erreur TS.

- [ ] **Step 4 : Test UI manuel**

1. `pnpm dev`
2. Découvrir un lieu en GPS
3. Vérifier toast affiche `+1 Gloire / +1 👑`
4. Découvrir 2 autres lieux dans la session
5. À la 3e découverte : toast doit afficher `+1 Gloire / +2 👑 (Mini-quête !)`
6. Le compteur Couronnes au header doit s'updater immédiatement

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/lib/discoverPlace.ts
git commit -m "feat(crowns): toast enrichi gain Couronne + bonus mini-quête (front)"
```

---

### Task 2.3 : Push + Deploy de la Phase 2

- [ ] **Step 1 : Push**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
git push origin main
```

- [ ] **Step 2 : Deploy Netlify prod**

```powershell
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm dlx netlify deploy --prod --dir="C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web/dist"
```

- [ ] **Step 3 : Update mémoire XO + CLAUDE.md app**

Mettre à jour `apps/explore-web/CLAUDE.md` (section éco Couronnes) si elle existe et `MEMORY.md` (vault) avec une entrée résumant le nouveau système. Référence : feedback `feedback_update_claudemd.md`.

---

## Phase 3 — Vérifications & Garde-fous post-déploiement

### Task 3.1 : Monitoring 48h sur prod

- [ ] **Step 1 : Vérifier la distribution des coffres réels sur 24h**

Après 1 jour en prod :

```powershell
pnpm dlx supabase db query "
SELECT
  date_trunc('hour', created_at) AS h,
  count(*) AS harvests
FROM activity_log
WHERE type = 'harvest_crown'
  AND created_at >= now() - interval '24 hours'
GROUP BY 1
ORDER BY 1;
"
```
Expected: courbe en cloche avec pic 12h-20h reflétant le drip.

- [ ] **Step 2 : Vérifier le baseline "0 lieu"**

Sélectionner un user à 0 lieu veillé qui a joué récemment :

```powershell
pnpm dlx supabase db query "
SELECT u.id, count(DISTINCT pv.place_id) AS lieux_veilles, uc.balance
FROM users u
LEFT JOIN place_veille pv
  ON pv.expedition_id IN (SELECT expedition_id FROM expedition_members WHERE user_id = u.id)
LEFT JOIN user_crowns uc ON uc.user_id = u.id
GROUP BY u.id, uc.balance
HAVING count(DISTINCT pv.place_id) = 0
ORDER BY uc.balance DESC NULLS LAST
LIMIT 10;
"
```
Expected: les "0 lieu" actifs ont une balance > 0 (énigme + découverte si ils ont joué).

- [ ] **Step 3 : Si la moyenne empirique des coffres/jour est trop loin de la prévision, ajuster `crowns_proba_k`**

Exemple : si les gros bâtisseurs râlent que "même 100 lieux = pas grand chose", on peut monter K à 4.5 :

```sql
UPDATE app_settings SET value = '4.5' WHERE key = 'crowns_proba_k';
```

Pas de migration, pas de redeploy. C'était le but du paramétrage.

---

## Récap fichiers touchés

**Migrations créées :**
- `supabase/migrations/121_app_settings_crowns_seeds.sql`
- `supabase/migrations/122_crowns_progressive.sql`
- `supabase/migrations/123_crowns_discovery_quest.sql`

**Code modifié :**
- `apps/explore-web/src/lib/discoverPlace.ts` (toast + refresh store Couronnes)

**Documentation à jour :**
- `apps/explore-web/CLAUDE.md` (section éco Couronnes — si existante)
- Mémoire XO (entrée résumant la nouvelle éco)

---

## Notes finales

- **Pas de table de schéma supplémentaire.** Tout passe par hash deterministe + `app_settings`. Pareto.
- **Rétrocompat front :** la signature de `get_my_crowns_state` et `harvest_crown` n'a pas changé. Les anciens clients continuent de marcher.
- **Phase 5 (influence à distance par Couronnes) :** sera calibrée en fonction de l'éco constatée empiriquement après 1-2 semaines de Phase 1+2 en prod.
