# Explore — la Carte, l'écran : plan d'implémentation (1/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Explore en quatre onglets, et l'écran Carte tel que maquetté — la carte médiévale, ses lieux (billes, sceaux, pilules de revendication, curiosités, regroupements), le nom du territoire, la rose des vents et « ma position », avec leurs données côté back.

**Architecture :** une fonction de lecture `carte_lieux()` renvoie tous les lieux visibles avec l'état propre à celui qui regarde ; `territoire_en(lat, lng)` nomme le territoire au centre de la carte. Côté V2, `features/carte` (api → hooks → lib → composants) dessine une carte MapLibre dont **les lieux sont des calques** (source GeoJSON regroupée), jamais des éléments HTML. Le style de fond est un filtre pur du style OpenFreeMap ; ses couleurs viennent des jetons.

**Tech Stack :** PostgreSQL + PostGIS (Supabase), React 19, React Router 8, TanStack Query 5, supabase-js 2, **maplibre-gl 5.18.0** (la version de la V1), Vitest.

**Spec :** `docs/superpowers/specs/2026-09-28-v2-carte-design.md` (cadre : §0 de `2026-08-18-app-v2-design.md` ; socle : `2026-09-26-v2-socle-design.md`).

**Plan 2/2 (à écrire après les maquettes)** : la fiche d'un lieu, la visite, la revendication et les expéditions, la feuille d'une Curiosité (« Vu », réactions), les parcours Ajouter (lieu, pin GPS, curiosité) et l'appui long. **Leurs maquettes Figma d'abord** (règle : un écran n'est fini que comparé à sa maquette).

## Global Constraints

- Branche `feat/v2-socle`. Migration **363** (la dernière appliquée est 362), en-tête `-- WHY :`, testée dans `BEGIN … ROLLBACK` (`pnpm dlx supabase db query --linked -f <fichier>`), puis **GO d'Uriel** avant `pnpm dlx supabase db push --linked`.
- Toute fonction nouvelle lit `auth.uid()` ; aucune ne prend de `p_user_id`. `CREATE OR REPLACE` d'une fonction existante : partir de sa définition **live**, copiée entière.
- Lieux montrés : jamais `masked`, jamais `private` (sauf les siens).
- Code V2 : `.claude/rules/v2.md` — simplicité, en-tête QUOI/POURQUOI, README par dossier, **aucune valeur visuelle hors `tokens.css`** (la carte lit ses couleurs dans les jetons), toute brique de `shared/ui` sur `/v2/da`. Une zone n'importe jamais une autre zone ni la coquille.
- Rendu (spec §2-3) : noir et crème ; inconnu = bille parchemin avec « ? », **toujours sous** les autres ; connu = sceau crème, icône à l'encre ; visité = sceau d'encre plein, icône crème ; **tous les sceaux de même taille** ; pilules et curiosités **de près seulement** ; ombrage léger à plat ; **terrain 3D seulement si inclinaison > 15° et zoom ≥ 9** ; inclinable jusqu'à 70°, ouverte à plat ; carte épurée (ni routes secondaires, ni chemins, ni ruisseaux, ni lieux-dits, ni bâtiments).
- Maquettes Figma (fichier `MKqyVhDPreg06PMEAaDxde`) : `162:107` « Carte — médiévale (lancement) », `201:173` « Carte — Ajouter (feuille ouverte) », planche `184:170` des états, variante couleur `197:149`, Préférences `91:166`.
- Vocabulaire : « Explorateur », « Porteur », « Curiosité », « revendiquer ». Jamais « Veilleur », jamais « faction ».

## Review Focus

1. **Base injoignable ou réponse illisible** au chargement de la carte → la carte de fond s'affiche quand même, avec un message discret « Les lieux n'ont pas pu être chargés » et « Réessayer » ; jamais un écran blanc. *Test : Task 5.*
2. **Aucune position (refus de géolocalisation)** → « Ma position » affiche « Position indisponible » sans planter ; la carte reste centrée sur son point de départ. *Test : Task 6.*
3. **Un lieu sans type ni icône** (données anciennes) → il s'affiche avec le sceau par défaut, jamais une marque vide ou une erreur de la carte. *Test : Task 3 (lecteur) et Task 4 (images).*
4. **Territoire introuvable** (au-dessus de la mer, hors des contours) → l'inscription disparaît en fondu, sans texte « null » ni erreur. *Test : Task 2 (SQL) et Task 6.*
5. **Un lieu privé ou masqué d'un autre** → jamais renvoyé par `carte_lieux()` ; les siens, si. *Test : Task 2.*

---

## Carte des fichiers

```
supabase/migrations/363_carte_explore.sql          places.nature, users.lieux_en_couleur, territoires_historiques,
                                                    carte_lieux(), territoire_en(), préférences étendues
supabase/tests/v2-carte/363_carte.sql               test annulé
apps/web-v2/package.json                            + maplibre-gl 5.18.0
apps/web-v2/index.html                              + IM Fell English (italique) dans le lien Google Fonts
apps/web-v2/src/shared/styles/tokens.css            + jetons --carte-*, --font-inscription
apps/web-v2/src/app/da/daTokens.ts                  + les nouveaux jetons
apps/web-v2/src/app/navigation/tabs.ts (+ test)     quatre onglets : accueil, carte, messages, compte
apps/web-v2/src/app/shell/Shell.tsx, TabBar.tsx     « + » et cloche en haut, Compte en bas (avatar)
apps/web-v2/src/app/routes/carte.tsx                /:tab/ajouter, /:tab/notifications, /carte/lieu/:id
apps/web-v2/src/assets/ui/ajouter.svg, cloche.svg   pochoirs de l'en-tête (Figma 162:107)
apps/web-v2/src/assets/ui/rose-des-vents.svg        Figma 186:170
apps/web-v2/src/features/compte/components/CompteScreen.tsx   l'onglet Compte : mon profil + Préférences, Déconnexion
apps/web-v2/src/features/carte/
  api/lireCarte.ts (+ test)        types et lecture du JSON de carte_lieux / territoire_en
  api/carte.ts                      fetchCarteLieux(), fetchTerritoire()
  hooks/useCarteLieux.ts, useTerritoire.ts
  lib/style.ts (+ test)             filtre pur du style OpenFreeMap → style parchemin
  lib/couleurs.ts                   lit les jetons --carte-* au démarrage
  lib/sceaux.ts                     dessine les images des marques (bille, sceaux, curiosité, groupe)
  lib/relief.ts (+ test)            règle pure : terrain 3D ou non
  components/CarteScreen.tsx (+ test, .module.css)
  components/Inscription.tsx (+ .module.css)     le nom du territoire, en italique de copiste
  components/AjouterFeuille.tsx     la feuille du « + » (Un lieu · Un pin GPS · Une curiosité)
supprimés (accord d'Uriel requis) : features/codex/, features/campement/, assets/ui/onglet-codex.png, onglet-campement.png
```

---

### Task 1 : Explore en quatre onglets, l'en-tête « + » et cloche

**Files:**
- Modify: `apps/web-v2/src/app/navigation/tabs.ts`, `tabs.test.ts`
- Modify: `apps/web-v2/src/app/shell/Shell.tsx`, `Shell.module.css`, `Shell.test.tsx`, `TabBar.tsx`, `DetailPane.test.tsx`
- Create: `apps/web-v2/src/features/compte/components/CompteScreen.tsx` (+ `.module.css`, + test)
- Create: `apps/web-v2/src/assets/ui/ajouter.svg`, `cloche.svg`
- Create: `apps/web-v2/src/app/routes/carte.tsx` ; Modify: `app/router.tsx`
- Modify: `features/compte/components/ProfilFragments.tsx` (la tuile « à découvrir » mène à la boutique, plus au Codex)
- Delete (**après accord explicite d'Uriel**) : `features/codex/`, `features/campement/`, `assets/ui/onglet-codex.png`, `assets/ui/onglet-campement.png`

**Interfaces:**
- Produces: `type TabId = 'accueil' | 'carte' | 'messages' | 'compte'` ; routes `/:tab/ajouter`, `/:tab/notifications`, `/carte/lieu/:id`.

- [ ] **Step 1 : les tests d'abord.** Dans `tabs.test.ts`, remplacer les cas `codex` par :

```ts
test('quatre onglets, dans l’ordre de la maquette', () => {
  expect(TABS.map((t) => t.id)).toEqual(['accueil', 'carte', 'messages', 'compte'])
  expect(isTabId('codex')).toBe(false)
  expect(isTabId('compte')).toBe(true)
})
```

Dans `Shell.test.tsx` :

```ts
test('l’en-tête porte « Ajouter » et « Notifications », la barre porte le Compte', () => {
  renderAt('/carte')
  expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Compte/ })).toBeInTheDocument()
})

test('« Ajouter » ouvre la feuille par-dessus l’onglet courant', async () => {
  const router = renderAt('/carte')
  await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
  expect(router.state.location.pathname).toBe('/carte/ajouter')
})
```

Remplacer dans `DetailPane.test.tsx` et `ProfilExplorateur.test.tsx` les adresses `/codex…` par `/messages…`.

- [ ] **Step 2 :** `pnpm --filter web-v2 test -- tabs Shell` → **FAIL** (`codex` encore présent, boutons absents).

- [ ] **Step 3 : `tabs.ts`.**

```ts
export type TabId = 'accueil' | 'carte' | 'messages' | 'compte'

export const TABS = [
  { id: 'accueil', label: 'Accueil', path: '/accueil' },
  { id: 'carte', label: 'Carte', path: '/carte' },
  { id: 'messages', label: 'Messages', path: '/messages' },
  { id: 'compte', label: 'Compte', path: '/compte' },
] as const satisfies readonly { id: TabId; label: string; path: `/${TabId}` }[]
```

Mettre à jour son en-tête (« la liste des quatre onglets »).

- [ ] **Step 4 : les icônes de l'en-tête.** Exporter depuis Figma (`get_design_context` sur `162:107`, calques « Ajouter » et « Notifications ») vers `assets/ui/ajouter.svg` et `assets/ui/cloche.svg` ; les ajouter au tableau de `assets/ui/README.md` (« pochoirs de l'en-tête, 24 × 24 »). Le point rouge de la cloche n'est **pas** dans le SVG : c'est un élément à part, affiché s'il y a du nouveau (Plan 2 : pour l'instant jamais).

- [ ] **Step 5 : `Shell.tsx`.** Retirer le bouton avatar et `useExplorateur` ; `SCREENS` devient `{ accueil, carte, messages, compte: CompteScreen }`. Ajouter à droite du logo :

```tsx
<div className={styles.actions}>
  <button type="button" className={styles.action} aria-label="Ajouter"
    onClick={() => { if (active) void navigate(`/${active}/ajouter`) }}>
    <img src={ajouter} alt="" />
  </button>
  <button type="button" className={styles.action} aria-label="Notifications"
    onClick={() => { if (active) void navigate(`/${active}/notifications`) }}>
    <img src={cloche} alt="" />
  </button>
</div>
```

Le retour de focus à la fermeture d'un détail se fait désormais vers `Ajouter` (l'avatar n'existe plus dans l'en-tête). `Shell.module.css` : la zone `avatar` de la grille devient `actions` ; boutons de 44 × 44 (cible tactile), icône 24 px, espacés de `var(--space-3)`.

- [ ] **Step 6 : `TabBar.tsx`.** `ICONS` perd `codex` et `campement` ; l'onglet `compte` affiche **l'avatar** (composant `Avatar` taille `petit`, via `useMonIdentifiant` + `useExplorateur`) au lieu d'un pochoir. Comme la barre est dans la coquille, qui a le droit d'importer la zone Compte, c'est permis.

- [ ] **Step 7 : `CompteScreen.tsx`** — l'onglet Compte montre mon profil, puis deux entrées :

```tsx
/**
 * QUOI     — l'onglet Compte : mon profil, puis Préférences et Déconnexion.
 * POURQUOI — le Compte est passé dans la barre basse (Uriel, 28/09) : ce qu'ouvrait le menu
 *            avatar vit ici, sans feuille.
 */
export function CompteScreen() {
  const moi = useMonIdentifiant()
  const navigate = useNavigate()
  if (!moi) return null
  return (
    <div className={styles.compte}>
      <ProfilExplorateur id={moi} />
      <nav className={styles.entrees} aria-label="Mon compte">
        <button type="button" onClick={() => void navigate('/compte/preferences')}>Préférences</button>
        <button type="button" onClick={() => void seDeconnecter()}>Se déconnecter</button>
      </nav>
    </div>
  )
}
```

Reprendre le style des entrées de `MenuAvatar.module.css`. `MenuAvatar` et la route `/:tab/menu` deviennent du **code mort** : les supprimer dans ce même commit (règle « code mort croisé = supprimé »), avec leurs tests.

- [ ] **Step 8 : `ProfilFragments.tsx`.** La tuile « + N à découvrir » ouvre la boutique (`https://runesdechene.com/collections/all`, nouvel onglet) au lieu de `/codex` ; mettre à jour son test (`ProfilExplorateur.test.tsx`, le lien a `href` vers la boutique).

- [ ] **Step 9 : `routes/carte.tsx` et `router.tsx`.**

```tsx
// /<onglet>/ajouter — la feuille du « + » (maquette 201:173)
export function RouteAjouter() {
  return <AjouterFeuille onFermer={useFermerDetail()} />
}
// /<onglet>/notifications — à venir (plan 2)
export function RouteNotifications() {
  return <DetailPane title="Notifications"><EmptyState>Rien de nouveau</EmptyState></DetailPane>
}
// /carte/lieu/<id> — la fiche arrive avec le plan 2
export function RouteLieu() {
  return <DetailPane title="Lieu"><EmptyState>La fiche du lieu arrive bientôt</EmptyState></DetailPane>
}
```

Dans `router.tsx`, sous `:tab` : `{ path: 'ajouter', Component: RouteAjouter }`, `{ path: 'notifications', Component: RouteNotifications }`, `{ path: 'lieu/:id', Component: RouteLieu }` ; retirer `menu`. `AjouterFeuille` (dans `features/carte/components/`) : une `Feuille` « Ajouter sur la carte » avec trois lignes (`Un lieu`, `Un pin GPS`, `Une curiosité`, leurs icônes et textes de la maquette 201:173). Chaque ligne est pour l'instant un bouton désactivé portant « bientôt » (plan 2).

- [ ] **Step 10 : suppressions.** **Demander l'accord d'Uriel**, puis `git rm -r` les dossiers `features/codex`, `features/campement` et les deux icônes d'onglet ; mettre à jour `features/README.md` (« quatre onglets et compte »).

- [ ] **Step 11 :** `pnpm --filter web-v2 lint && pnpm --filter web-v2 test` → vert. `pnpm dev:v2`, ouvrir `/v2/carte` : quatre onglets, avatar en bas, « + » et cloche en haut ; comparer à la maquette 162:107 à 390 px.

- [ ] **Step 12 : commit** `feat(v2): Explore en quatre onglets - Compte en bas, « + » et cloche dans l'en-tete ; Codex et Campement retires`.

---

### Task 2 : la base — `carte_lieux()`, `territoire_en()`, la Curiosité, « Mes lieux en couleur »

**Files:**
- Create: `supabase/migrations/363_carte_explore.sql`
- Create: `supabase/tests/v2-carte/363_carte.sql`

**Interfaces:**
- Produces (JSON) :
  - `carte_lieux()` → `[{ id, nom, lat, lng, nature: 'lieu'|'curiosite', icone: string|null, couleur: string|null, etat: 'inconnu'|'connu'|'visite', revendication: { nom: string, moi: boolean } | null }]`
  - `territoire_en(p_lat float8, p_lng float8)` → `{ territoire: string|null, pays: string|null }`
  - `get_my_preferences()` gagne `lieuxEnCouleur: boolean` ; `set_my_preference('lieux_en_couleur', bool)`.

- [ ] **Step 1 : le test d'abord** (`363_carte.sql`), sur le modèle de `supabase/tests/v2-compte/` :

```sql
-- 363 : la carte d'Explore. Annulé.
BEGIN;
\ir ../../migrations/363_carte_explore.sql
SELECT set_config('request.jwt.claims', json_build_object('sub','cb16ff47-1ead-4adf-8eff-04d117551541','role','authenticated')::text, true);
DO $test$
DECLARE c json; t json; vu int; ext int; prive_autre int;
BEGIN
  c := public.carte_lieux();
  SELECT count(*) INTO vu FROM json_array_elements(c) e WHERE e->>'etat' = 'visite';
  SELECT count(*) INTO prive_autre FROM json_array_elements(c) e JOIN places p ON p.id = e->>'id'
   WHERE (p.private OR p.masked) AND p.author_id <> 'cb16ff47-1ead-4adf-8eff-04d117551541';
  t := public.territoire_en(43.70, 7.26);   -- Nice
  RAISE EXCEPTION 'BILAN lieux=% visites=% prives_autres=% nice=% mer=% pref=%',
    json_array_length(c), vu, prive_autre, t, public.territoire_en(43.4, 7.4),
    public.get_my_preferences() -> 'lieuxEnCouleur';
END $test$;
ROLLBACK;
```

Attendu après la Step 3 : `lieux` ≈ nombre de lieux visibles, `visites` > 0, **`prives_autres=0`**, `nice={"territoire":"Comté de Nice","pays":"France"}`, `mer={"territoire":null,"pays":null}`, `pref=false`.

- [ ] **Step 2 :** lancer le test → **FAIL** (`function carte_lieux() does not exist`).

- [ ] **Step 3 : la migration.**

```sql
-- 363 — La carte d'Explore
--
-- WHY : spec 2026-09-28-v2-carte-design.md. Une lecture unique de tous les lieux visibles avec
-- l'état propre à celui qui regarde (inconnu / connu / visité) et la revendication affichée ;
-- le nom du territoire au centre de la carte ; la Curiosité (un point d'intérêt trop petit pour
-- être un lieu) ; l'option « Mes lieux en couleur ». Lectures seules, auth.uid().
--
-- SCHEMA CHECKED (28/09/2026) : places(id, title, latitude, longitude, author_id, private, masked,
--   departement, pays) ; place_tags(place_id, tag_id, is_primary) ; tags(id, icon, color) ;
--   place_explorers(place_id, user_id) ; places_discovered(user_id, place_id) ;
--   place_veille(place_id, expedition_id, veilleur_user_id) ; expeditions(id, title) ;
--   expedition_members(expedition_id, user_id) ; users(display_name, first_name).

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'lieu'
  CHECK (nature IN ('lieu', 'curiosite'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS lieux_en_couleur boolean NOT NULL DEFAULT false;

-- Les noms historiques des territoires, fixés par Uriel. Sans entrée : le nom du département.
CREATE TABLE IF NOT EXISTS public.territoires_historiques (
  departement text PRIMARY KEY,   -- = geo_departements.nom
  nom text NOT NULL
);
ALTER TABLE public.territoires_historiques ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.territoires_historiques FROM anon, authenticated;
INSERT INTO public.territoires_historiques (departement, nom)
VALUES ('Alpes-Maritimes', 'Comté de Nice') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.carte_lieux()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT COALESCE(json_agg(json_build_object(
    'id', p.id, 'nom', p.title, 'lat', p.latitude, 'lng', p.longitude, 'nature', p.nature,
    'icone', t.icon, 'couleur', t.color,
    'etat', CASE
      WHEN EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = moi.id) THEN 'visite'
      WHEN p.author_id = moi.id
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = p.id AND d.user_id = moi.id) THEN 'connu'
      ELSE 'inconnu' END,
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), COALESCE(NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), 'Explorateur')),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id))
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = p.id AND p.nature = 'lieu')
  )), '[]'::json)
  FROM places p CROSS JOIN moi
  LEFT JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary
  LEFT JOIN tags t ON t.id = pt.tag_id
  WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
    AND ((p.masked IS NOT TRUE AND p.private IS NOT TRUE) OR p.author_id = moi.id);
$$;
REVOKE ALL ON FUNCTION public.carte_lieux() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.carte_lieux() TO authenticated;

CREATE OR REPLACE FUNCTION public.territoire_en(p_lat float8, p_lng float8)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
  SELECT json_build_object(
    'territoire', CASE WHEN r.departement IS NOT NULL
                       THEN COALESCE((SELECT h.nom FROM territoires_historiques h WHERE h.departement = r.departement), r.departement)
                  END,
    'pays', r.pays)
  FROM (
    SELECT (SELECT d.nom FROM geo_departements d
             WHERE ST_Contains(d.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) LIMIT 1) AS departement,
           (SELECT g.nom_fr FROM geo_pays g
             WHERE ST_Contains(g.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)) LIMIT 1) AS pays
  ) r;
$$;
REVOKE ALL ON FUNCTION public.territoire_en(float8, float8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.territoire_en(float8, float8) TO authenticated;
```

Puis **copier entières** les définitions live de `get_my_preferences` et `set_my_preference` (migration 353) : ajouter `'lieuxEnCouleur', u.lieux_en_couleur` à la première, et `WHEN 'lieux_en_couleur' THEN UPDATE users SET lieux_en_couleur = p_valeur WHERE id = (auth.uid())::text;` à la seconde.

*Note pour l'exécutant :* `territoire_en` se contente de « contient », sans le repli « au plus proche » de `_rattacher_lieu` (migration 351) : au-dessus de la mer, on **veut** « rien ».

- [ ] **Step 4 :** relancer le test → le BILAN attendu. Vérifier aussi que `json_array_length(c)` est proche du nombre de lieux visibles (`SELECT count(*) FROM places WHERE masked IS NOT TRUE AND private IS NOT TRUE`), et mesurer la durée de `SELECT carte_lieux()` (`EXPLAIN ANALYZE`) : **moins de 500 ms**, sinon ajouter les index `place_explorers(user_id, place_id)` et `places_discovered(user_id, place_id)` s'ils manquent.

- [ ] **Step 5 : GO d'Uriel**, `pnpm dlx supabase db push --linked`, puis relancer le test contre la prod ; `pnpm --filter web-v2 gen:types`.

- [ ] **Step 6 : commit** `feat(db): la carte d'Explore - carte_lieux, territoire_en, Curiosite, Mes lieux en couleur (363, appliquee)`.

---

### Task 3 : lire la carte côté V2

**Files:**
- Create: `apps/web-v2/src/features/carte/api/lireCarte.ts` (+ `lireCarte.test.ts`), `api/carte.ts`
- Create: `apps/web-v2/src/features/carte/hooks/useCarteLieux.ts`, `useTerritoire.ts`
- Modify: `apps/web-v2/src/features/compte/api/preferences.ts` (`lieuxEnCouleur`), `components/PreferencesPage.tsx` (+ test)

**Interfaces:**
- Consumes : les JSON de la Task 2.
- Produces :

```ts
export type EtatLieu = 'inconnu' | 'connu' | 'visite'
export type LieuCarte = {
  id: string; nom: string; lat: number; lng: number
  nature: 'lieu' | 'curiosite'; icone: string | null; couleur: string | null; etat: EtatLieu
  revendication: { nom: string; moi: boolean } | null
}
export type Territoire = { territoire: string | null; pays: string | null }
export function lireLieux(json: unknown): LieuCarte[]
export function lireTerritoire(json: unknown): Territoire
export function useCarteLieux(): { lieux: LieuCarte[] | undefined; erreur: boolean; reessayer: () => void }
export function useTerritoire(centre: { lat: number; lng: number } | null): string | null  // le nom à inscrire
```

- [ ] **Step 1 : les tests d'abord** (`lireCarte.test.ts`) :

```ts
test('un lieu complet se lit', () => {
  expect(lireLieux([{ id: 'a', nom: 'Trophée', lat: 43.7, lng: 7.4, nature: 'lieu', icone: 'x.svg', couleur: '#708d44',
    etat: 'visite', revendication: { nom: 'Rémy', moi: false } }])[0]).toMatchObject({ etat: 'visite', revendication: { nom: 'Rémy' } })
})

test('un lieu sans icône ni revendication reste lisible', () => {
  const [l] = lireLieux([{ id: 'b', nom: 'Borne', lat: 44, lng: 7, nature: 'curiosite', icone: null, couleur: null, etat: 'inconnu', revendication: null }])
  expect(l.icone).toBeNull()
  expect(l.revendication).toBeNull()
})

test('un état inconnu de la base est lu comme « inconnu », jamais une erreur', () => {
  expect(lireLieux([{ id: 'c', nom: 'X', lat: 1, lng: 1, nature: 'lieu', icone: null, couleur: null, etat: 'bizarre', revendication: null }])[0].etat).toBe('inconnu')
})

test('au-dessus de la mer, pas de territoire', () => {
  expect(lireTerritoire({ territoire: null, pays: null })).toEqual({ territoire: null, pays: null })
})
```

- [ ] **Step 2 :** `pnpm --filter web-v2 test -- lireCarte` → **FAIL**.

- [ ] **Step 3 :** écrire `lireCarte.ts` avec les lecteurs de `features/compte/api/lire.ts`. **Une zone n'importe pas une autre zone** : déplacer d'abord `lire.ts` vers `shared/lib/lire.ts` (et son README), mettre à jour les imports de la zone Compte dans le même commit. `etat` et `nature` se lisent par liste blanche, avec `inconnu` et `lieu` par défaut. `api/carte.ts` :

```ts
export async function fetchCarteLieux(): Promise<LieuCarte[]> {
  const { data, error } = await supabase.rpc('carte_lieux')
  if (error) throw error
  return lireLieux(data)
}
export async function fetchTerritoire(lat: number, lng: number): Promise<Territoire> {
  const { data, error } = await supabase.rpc('territoire_en', { p_lat: lat, p_lng: lng })
  if (error) throw error
  return lireTerritoire(data)
}
```

`useTerritoire` arrondit le centre à 2 décimales pour la clé de cache (un déplacement de quelques mètres ne relance rien) et renvoie `territoire ?? null` au zoom ≥ 8, `pays` entre 5 et 8, `null` en dessous.

- [ ] **Step 4 : Préférences.** `Preferences` gagne `lieuxEnCouleur: boolean`, `ClePreference` gagne `'lieux_en_couleur'` ; dans `PreferencesPage`, sous « Montrer tes envies », la ligne **« Mes lieux en couleur »** (« Les lieux que tu as visités prennent la couleur de leur type. », icône palette de la maquette 91:166, exportée en `assets/ui/palette.svg`). Test : l'interrupteur appelle `set_my_preference` avec `lieux_en_couleur`.

- [ ] **Step 5 :** tests verts, lint vert. **Commit** `feat(v2): lire la carte - lieux, territoire, et l'option Mes lieux en couleur`.

---

### Task 4 : le fond de carte et les marques

**Files:**
- Modify: `apps/web-v2/package.json` (`"maplibre-gl": "5.18.0"`), `index.html` (IM Fell English italique dans le lien Google Fonts)
- Modify: `apps/web-v2/src/shared/styles/tokens.css`, `app/da/daTokens.ts`
- Create: `apps/web-v2/src/features/carte/lib/style.ts` (+ test), `lib/couleurs.ts`, `lib/sceaux.ts`, `lib/relief.ts` (+ test)

**Interfaces:**
- Produces :

```ts
export type CouleursCarte = { fond: string; eau: string; route: string; encre: string; halo: string; foret: string; ombre: string }
export function lireCouleurs(racine: HTMLElement): CouleursCarte          // lit --carte-*
export function styleParchemin(style: StyleSpecification, c: CouleursCarte): StyleSpecification
export function reliefVoulu(inclinaison: number, zoom: number): boolean  // > 15° et zoom ≥ 9
export function ajouterMarques(map: Map, lieux: LieuCarte[], c: CouleursCarte, couleurTypes: boolean): Promise<void>
```

- [ ] **Step 1 : les tests d'abord.** `relief.test.ts` :

```ts
test('la 3D ne s’allume qu’inclinée et d’assez près', () => {
  expect(reliefVoulu(0, 12)).toBe(false)
  expect(reliefVoulu(40, 7)).toBe(false)
  expect(reliefVoulu(40, 10)).toBe(true)
  expect(reliefVoulu(15, 10)).toBe(false)
})
```

`style.test.ts` (sur un petit style factice de trois calques) :

```ts
const base = { version: 8, sources: { openmaptiles: { type: 'vector', url: 'x' } }, layers: [
  { id: 'background', type: 'background', paint: {} },
  { id: 'road_minor', type: 'line', source: 'openmaptiles', paint: {} },
  { id: 'landcover_wood', type: 'fill', source: 'openmaptiles', paint: {} },
] } as StyleSpecification

test('les petites routes disparaissent, les forêts prennent l’olive pâle, l’ombrage est ajouté', () => {
  const s = styleParchemin(base, couleurs)
  expect(s.layers.map((l) => l.id)).not.toContain('road_minor')
  expect(s.layers.find((l) => l.id === 'landcover_wood')?.paint).toMatchObject({ 'fill-color': couleurs.foret })
  expect(s.layers.some((l) => l.type === 'hillshade')).toBe(true)
  expect(s.terrain).toBeUndefined()   // la 3D ne s'allume qu'à l'inclinaison
})
```

- [ ] **Step 2 :** `pnpm --filter web-v2 test -- relief style` → **FAIL**.

- [ ] **Step 3 : les jetons.** Dans `tokens.css`, un bloc « la carte » (valeurs du prototype `gravure.html`) :

```css
  /* La carte (spec Carte §2) : lues au démarrage par features/carte/lib/couleurs.ts. */
  --carte-fond: #ecdcbb;
  --carte-eau: #bfc3ad;
  --carte-route: #9c7c55;
  --carte-encre: #3f3024;
  --carte-halo: #f4e9d1;
  --carte-foret: #b9b58a;
  --carte-ombre: rgb(90 68 44 / 55%);
  --font-inscription: 'IM Fell English', serif;
```

Les ajouter à `daTokens.ts` (la page `/v2/da` les montre) ; le test des jetons doit rester vert.

- [ ] **Step 4 : `style.ts`** — reprendre la fonction `habiller` du prototype `.superpowers/brainstorm/carte/gravure.html` en **fonction pure** : retirer les calques `natural_earth|building|aeroway|poi_|shield|one_way|hatching|road_area|airport|highway-name|pitch|track|cemetery|hospital|school|rail|casing|park_outline|residential|minor|service|path|pedestrian|link|secondary|tertiary|street|waterway_other|waterway_tunnel|label_other|boundary_3` ; recolorer fond, eau, routes, limites, textes (halo) ; forêts `fill-color: foret, fill-opacity: 0.28` ; ajouter la source `relief` (`raster-dem`, `terrarium`, tuiles `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`, `maxzoom: 11`) et le calque `ombrage` (`hillshade`, méthode `igor`, `exaggeration: 0.3`, ombre `c.ombre`, reflets et accents transparents) juste avant la première route ; ajouter `sky` (horizon fondu dans le fond). **Pas de `terrain`** ici. **Copier** le tableau et non le muter (`structuredClone`).

- [ ] **Step 5 : `relief.ts`** : `export const reliefVoulu = (inclinaison, zoom) => inclinaison > 15 && zoom >= 9`.

- [ ] **Step 6 : `sceaux.ts`** — dessiner dans un `OffscreenCanvas` de 52 px (sceaux) ou 26 px (bille, curiosité), en pixelRatio 2, et `map.addImage(nom, imageData, { pixelRatio: 2 })` :
  - `bille` : disque `halo` 75 %, cercle d'encre 1,2 px, « ? » en Cabin gras, encre 70 % ;
  - `curiosite` : petite étoile ✦ pleine à l'encre (plus petite que les sceaux) ;
  - `groupe` : sceau d'encre plein (le nombre est un texte de calque, pas dans l'image) ;
  - pour chaque icône de type distincte (et `null` → icône par défaut `assets/ui/sceau-defaut.svg`, un losange) : `connu-<clé>` (disque crème, filet d'encre 1,5 px, icône masquée en encre) et `visite-<clé>` (disque d'encre plein, icône crème) ; si `couleurTypes`, `visite-<clé>` reprend le rendu « couleur » du prototype `gravure-couleur.html` (trois vagues de la couleur du type désaturée — `color-mix` à 58 % avec `#8c7c66` — icône blanche, sans bordure).
  - Une icône qui ne se charge pas (`Image.onerror`) retombe sur l'icône par défaut : jamais une marque vide.

- [ ] **Step 7 :** `pnpm install`, tests verts, lint vert. **Commit** `feat(v2): le fond de carte parchemin, l'ombrage, la regle du relief et les marques`.

---

### Task 5 : `CarteScreen` — la carte vivante

**Files:**
- Modify: `apps/web-v2/src/features/carte/components/CarteScreen.tsx` (+ `.module.css`, + `CarteScreen.test.tsx`), `features/carte/README.md`

**Interfaces:**
- Consumes : `useCarteLieux`, `styleParchemin`, `lireCouleurs`, `ajouterMarques`, `reliefVoulu`, `usePreferences` (zone Compte → **passer par un hook partagé** : déplacer la lecture de `lieuxEnCouleur` dans `shared/` ou la faire exposer par la coquille ; ne pas importer `features/compte` depuis `features/carte`).

- [ ] **Step 1 : le test d'abord** — MapLibre ne tourne pas dans jsdom : le simuler.

```tsx
vi.mock('maplibre-gl', () => ({ default: { Map: vi.fn(() => ({ on: vi.fn(), once: vi.fn(), addSource: vi.fn(),
  addLayer: vi.fn(), getSource: vi.fn(), remove: vi.fn(), setTerrain: vi.fn(), getPitch: () => 0, getZoom: () => 10 })) } }))

test('si les lieux ne se chargent pas, la carte reste là et propose de réessayer', async () => {
  rpcRenvoie('carte_lieux', { error: new Error('réseau') })
  renderAvecClient(<CarteScreen />)
  expect(await screen.findByText('Les lieux n’ont pas pu être chargés')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  expect(screen.getByTestId('carte')).toBeInTheDocument()
})
```

(`rpcRenvoie` et `renderAvecClient` : les aides de test déjà utilisées par les tests de la zone Compte — les réutiliser.)

- [ ] **Step 2 :** `pnpm --filter web-v2 test -- CarteScreen` → **FAIL**.

- [ ] **Step 3 : l'écran.**
  - Au montage : charger le style `https://tiles.openfreemap.org/styles/liberty`, le passer dans `styleParchemin(style, lireCouleurs(document.documentElement))`, créer la carte (`center [2.4, 46.6]`, `zoom 5`, `pitch 0`, `maxPitch 70`, `attributionControl: { compact: true }` — l'attribution OpenStreetMap est **obligatoire**, discrète).
  - Quand les lieux arrivent : une source GeoJSON `lieux` avec `cluster: true, clusterRadius: 40, clusterMaxZoom: 11`, les propriétés `etat`, `nature`, `image` (`bille` / `connu-<clé>` / `visite-<clé>` / `curiosite`), `pilule` (le nom), `moi`.
  - Calques, **dans cet ordre** (du dessous au-dessus) : `billes` (inconnus) → `sceaux` (connus et visités, `symbol-sort-key` visité au-dessus) → `curiosites` (`minzoom 12`) → `pilules` (texte `pilule`, `minzoom 12`, fond `pilule` / `pilule-moi` via `icon-text-fit`, décalé sous le sceau) → `groupes` (le sceau d'encre + `point_count` en crème).
  - `pitchend` et `zoomend` : `map.setTerrain(reliefVoulu(map.getPitch(), map.getZoom()) ? { source: 'relief', exaggeration: 1.1 } : null)`.
  - Toucher une marque de lieu : `navigate('/carte/lieu/' + id)` ; toucher un groupe : `easeTo` sur `getClusterExpansionZoom`.
  - Erreur de chargement des lieux : la carte reste, un bandeau discret « Les lieux n'ont pas pu être chargés » + « Réessayer ».
  - Au démontage : `map.remove()`.

- [ ] **Step 4 :** tests verts. `pnpm dev:v2`, `/v2/carte` : zoomer, dézoomer jusqu'à la France entière, incliner. **Comparer à la maquette 162:107 à 390 px** et au prototype ; **mesurer la fluidité sur un vrai téléphone** (Uriel) — critère qui a fait tomber la brume.

- [ ] **Step 5 : commit** `feat(v2): la Carte medievale - lieux en calques regroupes, pilules, relief a l'inclinaison`.

---

### Task 6 : l'inscription du territoire, la rose des vents, « ma position »

**Files:**
- Create: `apps/web-v2/src/features/carte/components/Inscription.tsx` (+ `.module.css`, + test)
- Create: `apps/web-v2/src/assets/ui/rose-des-vents.svg`, `fleuron.svg` (Figma `186:170`, calques de l'inscription `200:191`)
- Modify: `CarteScreen.tsx`, `CarteScreen.module.css`

**Interfaces:**
- Consumes : `useTerritoire(centre)` (centre et zoom lus sur `moveend`).

- [ ] **Step 1 : les tests d'abord** (`Inscription.test.tsx`) :

```tsx
test('le nom du territoire s’inscrit entre deux fleurons', () => {
  render(<Inscription nom="Comté de Nice" />)
  expect(screen.getByText('Comté de Nice')).toBeInTheDocument()
})

test('sans territoire, rien ne s’inscrit', () => {
  const { container } = render(<Inscription nom={null} />)
  expect(container).toBeEmptyDOMElement()
})
```

Et dans `CarteScreen.test.tsx` :

```tsx
test('sans position, « Ma position » le dit sans planter', async () => {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_ok: unknown, ko: (e: unknown) => void) => ko({ code: 1 }) } })
  renderAvecClient(<CarteScreen />)
  await userEvent.click(screen.getByRole('button', { name: 'Ma position' }))
  expect(await screen.findByText('Position indisponible')).toBeInTheDocument()
})
```

- [ ] **Step 2 :** → **FAIL**.

- [ ] **Step 3 :** `Inscription` : `var(--font-inscription)` en italique, taille de la maquette, encre `--carte-encre`, deux `fleuron.svg` (le second retourné), **fondu** de 400 ms quand le nom change (`key` sur le nom + animation CSS), `prefers-reduced-motion` respecté. `CarteScreen` : l'inscription sous la barre de recherche, la rose des vents en bas à gauche, le bouton rond « Ma position » en bas à droite (`getCurrentPosition` → `flyTo` zoom 13 ; refus → « Position indisponible » 3 s).

- [ ] **Step 4 :** tests et lint verts ; comparer à la maquette 162:107.

- [ ] **Step 5 : commit** `feat(v2): la Carte - le nom du territoire en italique de copiste, la rose des vents, ma position`.

---

### Task 7 : la recherche et le filtre

**Files:**
- Create: `apps/web-v2/src/features/carte/components/Recherche.tsx` (+ test), `components/FiltreFeuille.tsx`
- Modify: `CarteScreen.tsx`

- [ ] **Step 1 : les tests d'abord** :

```tsx
test('chercher un lieu par son nom propose le lieu, le toucher y va', async () => {
  const aller = vi.fn()
  render(<Recherche lieux={[lieu({ nom: 'Trophée des Alpes', lat: 43.74, lng: 7.43 })]} onAller={aller} />)
  await userEvent.type(screen.getByRole('searchbox', { name: 'Un lieu, une ville…' }), 'troph')
  await userEvent.click(screen.getByRole('option', { name: 'Trophée des Alpes' }))
  expect(aller).toHaveBeenCalledWith({ lat: 43.74, lng: 7.43 })
})

test('la recherche ignore les accents et la casse', async () => {
  render(<Recherche lieux={[lieu({ nom: 'Église Saint-Jean' })]} onAller={vi.fn()} />)
  await userEvent.type(screen.getByRole('searchbox'), 'eglise')
  expect(screen.getByRole('option', { name: 'Église Saint-Jean' })).toBeInTheDocument()
})
```

- [ ] **Step 2 :** → **FAIL**.

- [ ] **Step 3 :** `Recherche` : champ de la maquette (loupe, « Un lieu, une ville… »), recherche **dans les lieux déjà chargés** (normalisation `NFD` sans diacritiques, minuscules), dix résultats au plus. Les villes viendront au plan 2 (géocodage) : pas de requête externe ici. Le bouton **Filtre** ouvre `FiltreFeuille` (une `Feuille`) ; ce plan n'y met qu'un filtre, **« Seulement mes lieux »**. Les filtres type, saison, accès et bivouac demandent des colonnes que `carte_lieux()` ne renvoie pas encore : plan 2.

- [ ] **Step 4 :** tests et lint verts. **Commit** `feat(v2): la Carte - chercher un lieu, et le filtre`.

---

## Après la dernière tâche

- `pnpm --filter web-v2 lint && pnpm --filter web-v2 test && pnpm --filter web-v2 build` → vert.
- `pnpm dev:v2` : parcours complet dans le navigateur, à 390 px et sur desktop ; comparaison à chaque maquette citée.
- Push du lot. Écrire le **plan 2/2** une fois les maquettes (fiche d'un lieu, fenêtre de revendication, feuille d'une Curiosité, parcours Ajouter) validées dans Figma.
