# Hub V2 — plan 2 : Communauté

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** les quatre écrans du domaine Communauté du Hub V2 — Comptes (liste + fiche en tiroir), Compagnies (liste + fiche modifiable), Lieux à modérer (liste + fiche de modération), Signalements (file à deux volets) — au design validé, à la place des écrans « bientôt ».

**Architecture:** un dossier de zone `apps/hub-v2/src/features/communaute/` (api, hooks, lib, components) ; des briques communes nouvelles dans `src/shared/ui/` (en-tête de page, tiroir, recherche, pages) ; les fiches sont des routes imbriquées (`/communaute/comptes/:id`) rendues en tiroir. Les données : trois fonctions serveur nouvelles réservées aux admins (`hub_comptes`, `hub_compte`, `hub_compagnies`, `hub_compagnie`, `hub_modifier_compagnie`, `hub_lieux`) et les fonctions de modération existantes (`mod_*`, `changer_role`).

**Tech Stack:** la même que le plan 1 (Vite 8.3.1 · React 19.3.0 · React Router 8.4.0 · TanStack Query 5.104.0 · supabase-js 2.117.2 · CSS modules · Vitest 5.0.2) · Supabase (migrations à partir de **514**).

**Spec:** `docs/superpowers/specs/2026-10-14-hub-v2-design.md` (§5 coquille, §6 DA, §8 définitions et balises, §11 écrans). Maquettes Figma « Runes de Chêne — App v2 », section « Hub V2 — maquette (14/10) » : Comptes liste `594:961`, fiche `595:1140` ; Photos et avis `596:1319` (modèle de la file à deux volets) ; ouverture `587:761` (style des blocs, filtres, en-tête).

## Global Constraints

- Tout ce que dit le plan 1 vaut ici (`docs/superpowers/plans/2026-10-14-hub-v2-1-fondations-et-ouverture.md`, Global Constraints) : pnpm, TS strict (pas de `any`, `@ts-ignore`, `as unknown as`), jetons seulement (`packages/da/tokens.css`), en-têtes `QUOI / POURQUOI`, README par dossier, composant → hook → `api/`, animations par les jetons et `prefers-reduced-motion`, tout état navigable est une URL, pas de `console.log`, Conventional Commits avec `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Travail dans un dossier git **hors du dépôt** (un worktree sous `Desktop/DEVs/`, jamais sous le dépôt : Node y charge un second React) et toujours avec la casse exacte du chemin.
- Migrations à partir de **514**, `-- WHY:` + `-- SCHEMA CHECKED (date, live) :`, appliquées par `npx supabase db push --linked` après `--dry-run`, vérifiées en prod. Tout `CREATE OR REPLACE` d'une fonction existante part de sa définition live.
- Fonctions du Hub : `SECURITY DEFINER`, `SET search_path TO 'public'`, `IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;`, `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;` (`.claude/rules/supabase.md`).
- Balises (spec §8, décisions du 14/10) : **Nouveau** = créé il y a moins de 15 jours ; **Réactivé** = `entree_v2_le` (première connexion à la V2, mig 515) il y a moins de 15 jours et plus d'un jour après `created_at` ; **En sommeil** = créé avant le 07/10/2026 minuit Paris et `entree_v2_le` vide ; **Porteur** = au moins un Fragment ; **Admin** = `role = 'admin'`. Vocabulaire : « Porteur », « client validé », jamais « client relié » ; « Compagnie », jamais « faction ».
- « Lieux à modérer » = lieux non masqués, jamais vérifiés, ajoutés depuis la bascule (07/10/2026) — la même définition que la pastille du menu (`hub_ouverture`, mig 506).
- Hors de ce plan : associer un Fragment à la main (plan 4, avec l'écran Fragments) ; changer l'identifiant d'une Compagnie (jamais : `rename_faction` est fermée, mig 512) ; retirer un membre d'une Compagnie.

## Review Focus

1. **Une recherche avec `%` ou `_`** (« 100% », « jean_luc ») → elle cherche le texte tel quel, sans joker. (Test : Task 1, requête SQL lue ; la recherche utilise `position(lower(…) in lower(…))`.)
2. **Un compte sans nom, sans département, sans dernière visite** → la ligne affiche « Un Voyageur », « — », « jamais », sans planter. (Test : Task 3, `LigneDeCompte`.)
3. **Ouvrir `/communaute/comptes/<id inconnu>`** → le tiroir dit « Compte introuvable » et se ferme vers la liste, jamais un écran blanc. (Test : Task 4.)
4. **Enregistrer une Compagnie avec un nom déjà pris ou une couleur invalide** → le message d'erreur s'affiche dans le tiroir, rien n'est perdu de ce qui a été tapé. (Test : Task 5.)
5. **Un lieu masqué par un signalement** → il disparaît de « Lieux à modérer » et apparaît dans « Masqués » ; le signalement traité quitte la file et la pastille baisse. (Test : Tasks 6 et 7, invalidation des requêtes `hub-ouverture`, `hub-lieux`, `hub-signalements`.)

---

## Fichiers

```
supabase/migrations/514_hub_comptes.sql · 515_hub_compagnies.sql · 516_hub_lieux.sql
apps/hub-v2/src/
  shared/ui/   EnTeteDePage.tsx · Tiroir.tsx · ChampDeRecherche.tsx · Pages.tsx (+ .module.css, briques2.test.tsx)
  shared/lib/  dates.ts (+test)  — date courte, « jamais »
  app/router.tsx (routes de la Communauté)
  features/communaute/
    README.md
    api/        comptes.ts · compagnies.ts · lieux.ts · signalements.ts
    hooks/      useComptes.ts · useCompte.ts · useCompagnies.ts · useCompagnie.ts · useLieux.ts · useLieu.ts · useSignalements.ts
    lib/        balises.ts (+test) · csv.ts (+test) · couleur.ts (+test) · raisons.ts
    components/ Comptes.tsx · LigneDeCompte.tsx · TiroirCompte.tsx
                Compagnies.tsx · TiroirCompagnie.tsx
                Lieux.tsx · TiroirLieu.tsx
                Signalements.tsx
                Communaute.module.css   (+ tests *.test.tsx)
```

---

### Task 1: Migration 514 — `hub_comptes` et `hub_compte`

**Files:**
- Create: `supabase/migrations/514_hub_comptes.sql`

**Interfaces:**
- Produces: `hub_comptes(p_filtre text, p_recherche text, p_provenance text, p_departement text, p_tri text, p_limite integer, p_decalage integer) returns jsonb` :

```json
{ "total": 4750,
  "compteurs": { "comptes": 5023, "actifs": 312, "reactives": 1412, "sommeil": 2459 },
  "provenances": ["app","flyer","shopify","stand"],
  "departements": ["Ain","Aisne"],
  "lignes": [ { "id": "…", "nom": "Kelpie", "email": "k@…", "avatar": "https://…", "role": "user",
                "provenance": "flyer", "inscrit": "2026-10-14T…", "derniere_visite": "2026-10-14T…",
                "entree_v2": "2026-10-14T…", "client": true, "departement": "Seine-et-Marne", "code": "77",
                "fragments": 2 } ] }
```

- Produces: `hub_compte(p_id text) returns jsonb` — `null` si le compte n'existe pas, sinon :

```json
{ "id": "…", "nom": "Kelpie", "email": "…", "avatar": null, "role": "user", "provenance": "flyer",
  "inscrit": "…", "derniere_visite": "…", "entree_v2": "…", "client": true, "departement": "…", "code": "77",
  "compteurs": { "decouverts": 12, "visites": 4, "ajoutes": 0, "enigmes": 3 },
  "fragments": [ { "id": 7, "nom": "Hoplite", "image": "https://…", "source": "shopify", "quand": "…" } ],
  "achats": [ { "commande": "1042", "quand": "…", "statut": "unlocked", "tag": "hoplite" } ],
  "traces": [ { "type": "visite", "quand": "…", "texte": "Abbaye de Fontfroide" } ] }
```

- [ ] **Step 1: Relever les colonnes live** (lecture seule)

```bash
npx supabase db query --linked "select table_name, column_name from information_schema.columns where table_schema='public' and (table_name, column_name) in (('users','display_name'),('users','first_name'),('users','email_address'),('users','avatar_url'),('users','role'),('users','account_source'),('users','created_at'),('users','last_login_at'),('users','charte_signee_le'),('users','shopify_customer_id'),('place_explorers','user_id'),('place_explorers','place_id'),('place_explorers','visited_at'),('places','departement'),('places','author_id'),('places','title'),('geo_departements','nom'),('geo_departements','code'),('user_fragments','fragment_id'),('user_fragments','unlocked_at'),('user_fragments','source'),('title_fragments','name'),('title_fragments','image_url'),('purchase_log','shopify_order_id'),('purchase_log','email'),('purchase_log','status'),('purchase_log','shopify_tag'),('places_discovered','method'),('enigma_responses','correct')) order by 1,2"
```

Expected : les 29 couples. S'il en manque un, s'arrêter.

- [ ] **Step 2: La migration**

```sql
-- WHY: Hub V2, plan 2 (spec 2026-10-14-hub-v2-design §8, §11) : la liste des comptes et la fiche d'un
--      compte, réservées aux admins. La liste calcule pour chacun ce qu'aucune table ne garde : son
--      département (celui où il a visité le plus de lieux, comme get_profil_explorateur, mais sans le
--      réglage d'affichage public : l'équipe le voit — décision d'Uriel du 14/10) et son nombre de
--      Fragments. La recherche ne connaît pas de joker (position, pas ILIKE).
-- SCHEMA CHECKED (14/10/2026, information_schema live) : voir le plan 2, Task 1 Step 1 (29 colonnes) ;
--   places_discovered.method ∈ remote, gps, author ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public._hub_comptes_base()
 RETURNS TABLE (id text, nom text, email text, avatar text, role text, provenance text,
                inscrit timestamptz, derniere_visite timestamptz, charte timestamptz, client boolean,
                departement text, code text, fragments bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH visites AS (
    SELECT e.user_id, p.departement, count(*) AS n, max(e.visited_at) AS derniere
      FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.departement IS NOT NULL
     GROUP BY e.user_id, p.departement
  ),
  dep AS (
    SELECT DISTINCT ON (user_id) user_id, departement
      FROM visites ORDER BY user_id, n DESC, derniere DESC
  ),
  frag AS (SELECT user_id, count(*) AS n FROM user_fragments GROUP BY user_id)
  SELECT u.id::text, COALESCE(u.display_name, u.first_name, 'Un Voyageur'), u.email_address::text,
         u.avatar_url, COALESCE(u.role, 'user')::text, u.account_source::text,
         u.created_at, u.last_login_at, u.charte_signee_le, u.shopify_customer_id IS NOT NULL,
         d.departement, g.code, COALESCE(f.n, 0)
    FROM users u
    LEFT JOIN dep d ON d.user_id = u.id
    LEFT JOIN geo_departements g ON g.nom = d.departement
    LEFT JOIN frag f ON f.user_id = u.id;
$function$;

REVOKE ALL ON FUNCTION public._hub_comptes_base() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hub_comptes(
  p_filtre text DEFAULT 'tous', p_recherche text DEFAULT NULL, p_provenance text DEFAULT NULL,
  p_departement text DEFAULT NULL, p_tri text DEFAULT 'visite', p_limite integer DEFAULT 50,
  p_decalage integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recherche text := NULLIF(lower(btrim(p_recherche)), '');
  v_limite integer := LEAST(GREATEST(COALESCE(p_limite, 50), 1), 10000);
  v_decalage integer := GREATEST(COALESCE(p_decalage, 0), 0);
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_filtre NOT IN ('tous', 'nouveaux', 'reactives', 'sommeil', 'porteurs', 'equipe') THEN
    PERFORM _refus('Filtre inconnu', 'filtre');
  END IF;
  IF p_tri NOT IN ('visite', 'inscription', 'nom') THEN PERFORM _refus('Tri inconnu', 'tri'); END IF;

  WITH base AS (SELECT * FROM _hub_comptes_base()),
  filtres AS (
    SELECT * FROM base b
     WHERE (v_recherche IS NULL OR position(v_recherche IN lower(b.nom)) > 0
                                OR position(v_recherche IN lower(COALESCE(b.email, ''))) > 0)
       AND (p_provenance IS NULL OR b.provenance = p_provenance)
       AND (p_departement IS NULL OR b.departement = p_departement)
       AND CASE p_filtre
             WHEN 'tous' THEN true
             WHEN 'nouveaux' THEN b.inscrit >= now() - interval '15 days'
             WHEN 'reactives' THEN b.charte >= now() - interval '15 days' AND b.charte > b.inscrit + interval '1 day'
             WHEN 'sommeil' THEN b.inscrit < '2026-10-07'::timestamptz AND b.charte IS NULL
             WHEN 'porteurs' THEN b.fragments > 0
             WHEN 'equipe' THEN b.role IN ('admin', 'moderator')
           END
  ),
  page AS (
    SELECT * FROM filtres
     ORDER BY CASE WHEN p_tri = 'visite' THEN derniere_visite END DESC NULLS LAST,
              CASE WHEN p_tri = 'inscription' THEN inscrit END DESC,
              CASE WHEN p_tri = 'nom' THEN lower(nom) END ASC,
              id
     LIMIT v_limite OFFSET v_decalage
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtres),
    'compteurs', jsonb_build_object(
      'comptes', (SELECT count(*) FROM base),
      'actifs', (SELECT count(*) FROM base WHERE derniere_visite >= now() - interval '7 days'),
      'reactives', (SELECT count(*) FROM base WHERE charte > inscrit + interval '1 day'),
      'sommeil', (SELECT count(*) FROM base WHERE inscrit < '2026-10-07'::timestamptz AND charte IS NULL)),
    'provenances', COALESCE((SELECT jsonb_agg(DISTINCT provenance ORDER BY provenance) FROM base WHERE provenance IS NOT NULL), '[]'::jsonb),
    'departements', COALESCE((SELECT jsonb_agg(DISTINCT departement ORDER BY departement) FROM base WHERE departement IS NOT NULL), '[]'::jsonb),
    'lignes', COALESCE((SELECT jsonb_agg(to_jsonb(page.*)) FROM page), '[]'::jsonb))
    INTO v_resultat;
  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_comptes(text, text, text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_compte(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compte jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT to_jsonb(b.*) INTO v_compte FROM _hub_comptes_base() b WHERE b.id = p_id;
  IF v_compte IS NULL THEN RETURN NULL; END IF;

  RETURN v_compte || jsonb_build_object(
    'compteurs', jsonb_build_object(
      'decouverts', (SELECT count(*) FROM places_discovered WHERE user_id = p_id AND method = 'remote'),
      'visites', (SELECT count(*) FROM places_discovered WHERE user_id = p_id AND method = 'gps'),
      'ajoutes', (SELECT count(*) FROM places WHERE author_id = p_id),
      'enigmes', (SELECT count(*) FROM enigma_responses WHERE user_id = p_id AND correct)),
    'fragments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', f.fragment_id, 'nom', t.name, 'image', t.image_url,
                                          'source', f.source, 'quand', f.unlocked_at)
                       ORDER BY f.unlocked_at DESC NULLS LAST)
        FROM user_fragments f LEFT JOIN title_fragments t ON t.id = f.fragment_id
       WHERE f.user_id = p_id), '[]'::jsonb),
    'achats', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('commande', a.shopify_order_id, 'quand', a.created_at,
                                          'statut', a.status, 'tag', a.shopify_tag)
                       ORDER BY a.created_at DESC NULLS LAST)
        FROM purchase_log a
       WHERE a.user_id = p_id OR lower(a.email) = lower(v_compte->>'email')), '[]'::jsonb),
    'traces', COALESCE((
      SELECT jsonb_agg(t ORDER BY (t->>'quand') DESC) FROM (
        (SELECT jsonb_build_object('type', CASE d.method WHEN 'gps' THEN 'visite' ELSE 'decouverte' END,
                                   'quand', d.discovered_at, 'texte', p.title) AS t
           FROM places_discovered d JOIN places p ON p.id = d.place_id
          WHERE d.user_id = p_id AND d.method IN ('gps', 'remote')
          ORDER BY d.discovered_at DESC LIMIT 8)
        UNION ALL
        (SELECT jsonb_build_object('type', 'ajout', 'quand', p.created_at, 'texte', p.title)
           FROM places p WHERE p.author_id = p_id ORDER BY p.created_at DESC LIMIT 8)
        UNION ALL
        (SELECT jsonb_build_object('type', CASE WHEN r.correct THEN 'enigme' ELSE 'enigme_manquee' END,
                                   'quand', r.responded_at, 'texte', 'Énigme n° ' || r.enigma_id)
           FROM enigma_responses r WHERE r.user_id = p_id ORDER BY r.responded_at DESC LIMIT 8)
      ) x LIMIT 8), '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compte(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compte(text) TO authenticated;
```

(Si `db push` refuse une jointure pour un type, caster la colonne en `::text` dans la jointure, rien d'autre. L'ordre des traces est fait sur le texte ISO, qui se trie comme la date.)

- [ ] **Step 3: Appliquer et vérifier**

```bash
npx supabase db push --dry-run --linked     # seule 514 listée, sinon STOP
npx supabase db push --linked
npx supabase db query --linked "select has_function_privilege('anon','public.hub_comptes(text,text,text,text,text,integer,integer)','execute') as anon, has_function_privilege('authenticated','public._hub_comptes_base()','execute') as base_ouverte"
npx supabase db query --linked "select count(*), count(departement), count(*) filter (where fragments>0) from public._hub_comptes_base()"
npx supabase db query --linked "select public.hub_compte('x')"
```

Expected : `anon = false`, `base_ouverte = false` ; environ 5 000 comptes, quelques centaines avec un département et des Fragments ; le dernier appel est refusé (« Réservé à l’équipe ») — la porte tient.

- [ ] **Step 4: Types et commit**

Run (dans `apps/hub-v2`) : `pnpm gen:types` — Expected : `hub_comptes` et `hub_compte` dans `database.types.ts`.

```bash
git add supabase/migrations/514_hub_comptes.sql apps/hub-v2/src/shared/supabase/database.types.ts
git commit -m "feat(db): la liste et la fiche des comptes pour le Hub"
```

---

### Task 2: Les briques des écrans et les routes de la Communauté

**Files:**
- Create: `src/shared/ui/EnTeteDePage.tsx`, `Tiroir.tsx`, `ChampDeRecherche.tsx`, `Pages.tsx` + leurs `.module.css`, `src/shared/ui/briques2.test.tsx`
- Create: `src/shared/lib/dates.ts`, `dates.test.ts`
- Modify: `src/shared/ui/README.md`, `src/shared/lib/README.md`

(Chemins relatifs à `apps/hub-v2/`.)

**Interfaces:**
- Produces:
  - `EnTeteDePage({ surtitre, titre, phrase?, aDroite? })` — l'en-tête des écrans (surtitre en Bebas pâle, titre en Bebas 52, phrase, un élément à droite), comme l'ouverture et la maquette 594:961.
  - `Tiroir({ titre, retour, children })` — sur PC, un panneau à droite de largeur `--tiroir` sur un voile, qui glisse depuis la droite ; sur téléphone, pleine page. `retour` est l'adresse de la liste : le bouton « Fermer », le voile et la touche Échap y mènent (`useNavigate`).
  - `ChampDeRecherche({ valeur, onChange, etiquette })` — une gélule claire bordée avec la loupe ; `onChange` reçoit le texte après 300 ms sans frappe.
  - `Pages({ total, decalage, parPage, onDecalage })` — « 1 à 50 sur 4 750 » et « ← Précédents / Suivants → », masqués quand il n'y a qu'une page.
  - `dateCourte(iso: string | null): string` → `'14/10/2026'` ou `'jamais'` ; `moisAnnee(iso: string | null): string` → `'10/2026'` ou `'—'`.

- [ ] **Step 1: Écrire les tests (ils échouent)**

`src/shared/lib/dates.test.ts` :

```ts
import { dateCourte, moisAnnee } from './dates'

test('une date courte, à l’heure de Paris', () => {
  expect(dateCourte('2026-10-13T23:30:00Z')).toBe('14/10/2026')
})
test('pas de date : jamais', () => {
  expect(dateCourte(null)).toBe('jamais')
})
test('mois et année', () => {
  expect(moisAnnee('2025-03-02T10:00:00Z')).toBe('03/2025')
  expect(moisAnnee(null)).toBe('—')
})
```

`src/shared/ui/briques2.test.tsx` :

```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { ChampDeRecherche } from './ChampDeRecherche'
import { EnTeteDePage } from './EnTeteDePage'
import { Pages } from './Pages'
import { Tiroir } from './Tiroir'

test('l’en-tête montre surtitre, titre et phrase', () => {
  render(<EnTeteDePage surtitre="Communauté" titre="Les comptes" phrase="4 750 Explorateurs." />)
  expect(screen.getByRole('heading', { name: 'Les comptes' })).toBeInTheDocument()
  expect(screen.getByText('Communauté')).toBeInTheDocument()
})

test('les pages : rien quand tout tient sur une page', () => {
  const { container } = render(<Pages total={12} decalage={0} parPage={50} onDecalage={vi.fn()} />)
  expect(container).toBeEmptyDOMElement()
})

test('les pages : suivant avance d’une page', async () => {
  const onDecalage = vi.fn()
  render(<Pages total={120} decalage={0} parPage={50} onDecalage={onDecalage} />)
  expect(screen.getByText('1 à 50 sur 120')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Suivants →' }))
  expect(onDecalage).toHaveBeenCalledWith(50)
  expect(screen.getByRole('button', { name: '← Précédents' })).toBeDisabled()
})

test('la recherche attend 300 ms avant de chercher', () => {
  vi.useFakeTimers()
  const onChange = vi.fn()
  render(<ChampDeRecherche valeur="" onChange={onChange} etiquette="Un nom, un e-mail…" />)
  const champ = screen.getByRole('searchbox', { name: 'Un nom, un e-mail…' })
  act(() => {
    champ.focus()
  })
  // saisie directe (userEvent et les faux minuteurs ne s'entendent pas)
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(champ, 'kel')
    champ.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(onChange).not.toHaveBeenCalled()
  act(() => {
    vi.advanceTimersByTime(300)
  })
  expect(onChange).toHaveBeenCalledWith('kel')
  vi.useRealTimers()
})

test('le tiroir se ferme vers la liste (bouton et Échap)', async () => {
  const router = createMemoryRouter(
    [
      { path: '/liste', element: <p>La liste</p> },
      { path: '/liste/1', element: <Tiroir titre="Kelpie" retour="/liste"><p>Fiche</p></Tiroir> },
    ],
    { initialEntries: ['/liste/1'] },
  )
  render(<RouterProvider router={router} />)
  expect(screen.getByRole('dialog', { name: 'Kelpie' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(await screen.findByText('La liste')).toBeInTheDocument()
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/shared` — Expected: FAIL (modules introuvables).

- [ ] **Step 2: Les fonctions et les briques**

`src/shared/lib/dates.ts` :

```ts
/**
 * QUOI     — les dates des listes du Hub : « 14/10/2026 », « 10/2026 », « jamais ».
 * POURQUOI — toujours à l'heure de Paris : l'équipe et les joueurs y sont.
 */
const jour = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })
const mois = new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' })

export function dateCourte(iso: string | null): string {
  return iso ? jour.format(new Date(iso)) : 'jamais'
}

export function moisAnnee(iso: string | null): string {
  return iso ? mois.format(new Date(iso)) : '—'
}
```

`src/shared/ui/EnTeteDePage.tsx` :

```tsx
/**
 * QUOI     — l'en-tête d'un écran du Hub : surtitre (le domaine), titre, phrase, et à droite un bouton.
 * POURQUOI — le même en-tête que l'ouverture (maquettes 587:761, 594:961), une seule fois.
 */
import type { ReactNode } from 'react'
import styles from './EnTeteDePage.module.css'

export function EnTeteDePage({ surtitre, titre, phrase, aDroite }: {
  surtitre: string; titre: string; phrase?: string; aDroite?: ReactNode
}) {
  return (
    <header className={styles.entete}>
      <div className={styles.textes}>
        <p className={styles.surtitre}>{surtitre}</p>
        <h1 className={styles.titre}>{titre}</h1>
        {phrase && <p className={styles.phrase}>{phrase}</p>}
      </div>
      {aDroite}
    </header>
  )
}
```

`src/shared/ui/EnTeteDePage.module.css` : reprendre exactement les règles `.entete`, `.salut` (renommée `.textes`), `.date` (renommée `.surtitre`), `.bonjour` (renommée `.titre`) et `.phrase` de `src/features/accueil/components/Ouverture.module.css`.

`src/shared/ui/Tiroir.tsx` :

```tsx
/**
 * QUOI     — la fiche d'un élément, ouverte par-dessus sa liste : un panneau à droite sur PC, une
 *            pleine page sur téléphone (maquette 595:1140).
 * POURQUOI — la fiche a son adresse (/…/:id) ; fermer, c'est revenir à l'adresse de la liste — le
 *            bouton, le voile et la touche Échap font la même chose.
 */
import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import styles from './Tiroir.module.css'

export function Tiroir({ titre, retour, children }: { titre: string; retour: string; children: ReactNode }) {
  const naviguer = useNavigate()
  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.key === 'Escape') void naviguer(retour)
    }
    window.addEventListener('keydown', touche)
    return () => {
      window.removeEventListener('keydown', touche)
    }
  }, [naviguer, retour])

  return (
    <div className={styles.cadre}>
      <Link to={retour} className={styles.voile} aria-label="Fermer la fiche" tabIndex={-1} />
      <section className={styles.tiroir} role="dialog" aria-label={titre}>
        <Link to={retour} className={styles.fermer}>✕ Fermer</Link>
        {children}
      </section>
    </div>
  )
}
```

`src/shared/ui/Tiroir.module.css` :

```css
/*
 * QUOI     — le tiroir : pleine page au téléphone ; sur PC, un panneau qui glisse depuis la droite
 *            sur un voile léger.
 */
.cadre {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.voile {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--color-ombre) 12%, transparent);
  animation: apparait var(--duree-douce) var(--courbe-douce);
}

.tiroir {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: start;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4) var(--space-8);
  overflow-y: auto;
  background: var(--color-fond);
  animation: glisse var(--duree-douce) var(--courbe-douce);
}

.fermer {
  justify-self: start;
  font-weight: var(--weight-semi);
  font-size: var(--flux-size);
  color: var(--color-texte-doux);
  text-decoration: none;
}

@container app (width >= 900px) {
  .tiroir {
    inset: 0 0 0 auto;
    width: calc(var(--tiroir) + var(--space-8));
    padding: var(--space-6) var(--space-8) var(--space-8);
    border-left: 1px solid var(--color-sable);
    box-shadow: -8px 0 32px color-mix(in srgb, var(--color-ombre) 18%, transparent);
  }
}

@keyframes apparait {
  from { opacity: 0; }
}

@keyframes glisse {
  from { translate: 100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .voile,
  .tiroir {
    animation: none;
  }
}
```

`src/shared/ui/ChampDeRecherche.tsx` :

```tsx
/**
 * QUOI     — le champ de recherche des listes : une gélule claire bordée avec la loupe.
 * POURQUOI — chercher à chaque lettre ferait une requête par lettre : on attend 300 ms de calme.
 */
import { useEffect, useState } from 'react'
import loupe from '@/assets/ui/loupe.svg'
import styles from './ChampDeRecherche.module.css'

const ATTENTE = 300

export function ChampDeRecherche({ valeur, onChange, etiquette }: {
  valeur: string; onChange: (texte: string) => void; etiquette: string
}) {
  const [texte, setTexte] = useState(valeur)
  useEffect(() => {
    if (texte === valeur) return
    const minuteur = setTimeout(() => {
      onChange(texte)
    }, ATTENTE)
    return () => {
      clearTimeout(minuteur)
    }
  }, [texte, valeur, onChange])

  return (
    <label className={styles.champ}>
      <img src={loupe} alt="" />
      <input type="search" aria-label={etiquette} placeholder={etiquette} value={texte} onChange={(e) => {
        setTexte(e.target.value)
      }} />
    </label>
  )
}
```

`src/shared/ui/ChampDeRecherche.module.css` :

```css
.champ {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 220px;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-rond);
  background: var(--color-bloc);
}

.champ img {
  width: 14px;
  opacity: 0.5;
}

.champ input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--flux-size);
  color: var(--color-encre);
}

.champ input:focus {
  outline: none;
}

.champ:focus-within {
  border-color: var(--color-accent);
}
```

`src/shared/ui/Pages.tsx` :

```tsx
/**
 * QUOI     — la navigation entre les pages d'une liste : « 1 à 50 sur 4 750 », précédents, suivants.
 */
import styles from './Pages.module.css'

const nombre = new Intl.NumberFormat('fr-FR')

export function Pages({ total, decalage, parPage, onDecalage }: {
  total: number; decalage: number; parPage: number; onDecalage: (decalage: number) => void
}) {
  if (total <= parPage) return null
  const fin = Math.min(decalage + parPage, total)
  return (
    <div className={styles.pages}>
      <span>{`${nombre.format(decalage + 1)} à ${nombre.format(fin)} sur ${nombre.format(total)}`}</span>
      <span className={styles.boutons}>
        <button type="button" disabled={decalage === 0} onClick={() => {
          onDecalage(Math.max(0, decalage - parPage))
        }}>← Précédents</button>
        <button type="button" disabled={fin >= total} onClick={() => {
          onDecalage(decalage + parPage)
        }}>Suivants →</button>
      </span>
    </div>
  )
}
```

`src/shared/ui/Pages.module.css` :

```css
.pages {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  font-size: var(--flux-size);
  color: var(--color-texte-doux);
}

.boutons {
  display: flex;
  gap: var(--space-4);
}

.boutons button {
  border: 0;
  background: none;
  font-weight: var(--weight-semi);
  color: var(--color-accent);
}

.boutons button:disabled {
  color: var(--color-texte-pale);
}
```

Ajouter aux deux README une ligne par nouveau fichier.

Run: `pnpm --filter hub-v2 exec vitest run src/shared` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/hub-v2/src/shared
git commit -m "feat(hub-v2): l'en-tête des écrans, le tiroir, la recherche et les pages"
```

---

### Task 3: L'écran des comptes

**Files:**
- Create: `src/features/communaute/README.md`, `api/comptes.ts`, `hooks/useComptes.ts`, `lib/balises.ts`, `lib/balises.test.ts`, `lib/csv.ts`, `lib/csv.test.ts`, `components/Comptes.tsx`, `components/LigneDeCompte.tsx`, `components/Communaute.module.css`, `components/Comptes.test.tsx`
- Modify: `src/app/router.tsx`, `src/app/router.test.tsx`

**Interfaces:**
- Consumes: `hub_comptes` (Task 1) ; `EnTeteDePage`, `ChampDeRecherche`, `Pages` (Task 2) ; `Tuile`, `ChoixSegmente`, `Balise`, `Bloc` (plan 1) ; `dateCourte`, `moisAnnee`, `depuis`.
- Produces: `type Compte` ; `lireComptes(criteres: Criteres): Promise<ListeDeComptes>` ; `balisesDuCompte(c: Compte, maintenant: Date): { texte: string; teinte: Teinte }[]` ; `versCsv(lignes: Compte[]): string` ; route `/communaute/comptes` (avec enfant `:id`, rempli en Task 4).

- [ ] **Step 1: Écrire les tests des fonctions pures (ils échouent)**

`src/features/communaute/lib/balises.test.ts` :

```ts
import type { Compte } from '../api/comptes'
import { balisesDuCompte } from './balises'

const maintenant = new Date('2026-10-14T12:00:00Z')
const base: Compte = {
  id: 'u1', nom: 'Kelpie', email: 'k@exemple.fr', avatar: null, role: 'user', provenance: 'flyer',
  inscrit: '2026-10-14T09:00:00Z', derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:01:00Z',
  client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2,
}
const textes = (c: Compte) => balisesDuCompte(c, maintenant).map((b) => b.texte)

test('nouveau et porteur', () => {
  expect(textes(base)).toEqual(['Nouveau', 'Porteur'])
})
test('réactivé : entré dans la V2 il y a moins de 15 jours, plus d’un jour après l’inscription', () => {
  expect(textes({ ...base, inscrit: '2025-03-01T00:00:00Z', entree_v2: '2026-10-10T00:00:00Z', fragments: 0 })).toEqual(['Réactivé'])
})
test('réactivé il y a plus de 15 jours : plus de balise', () => {
  expect(textes({ ...base, inscrit: '2025-03-01T00:00:00Z', entree_v2: '2026-09-01T00:00:00Z', fragments: 0 })).toEqual([])
})
test('en sommeil : créé avant la bascule, jamais entré dans la V2', () => {
  expect(textes({ ...base, inscrit: '2024-02-01T00:00:00Z', entree_v2: null, fragments: 1 })).toEqual(['En sommeil', 'Porteur'])
})
test('un compte créé après la bascule sans être entré n’est pas en sommeil', () => {
  expect(textes({ ...base, inscrit: '2026-10-08T00:00:00Z', entree_v2: null, fragments: 0 })).toEqual(['Nouveau'])
})
test('admin', () => {
  expect(textes({ ...base, inscrit: '2024-01-01T00:00:00Z', entree_v2: '2024-01-01T00:00:00Z', role: 'admin', fragments: 22 })).toEqual(['Admin', 'Porteur'])
})
```

`src/features/communaute/lib/csv.test.ts` :

```ts
import type { Compte } from '../api/comptes'
import { versCsv } from './csv'

const c: Compte = {
  id: 'u1', nom: 'Jean; « le » Bon', email: 'j@x.fr', avatar: null, role: 'user', provenance: 'app',
  inscrit: '2026-10-14T09:00:00Z', derniere_visite: null, entree_v2: null, client: false,
  departement: null, code: null, fragments: 0,
}

test('une ligne d’en-tête puis une ligne par compte, séparées par des points-virgules', () => {
  const lignes = versCsv([c]).split('\r\n')
  expect(lignes[0]).toBe('nom;email;provenance;departement;fragments;inscrit;derniere_visite;role')
  expect(lignes[1]).toBe('"Jean; « le » Bon";j@x.fr;app;;0;2026-10-14T09:00:00Z;;user')
})

test('un guillemet est doublé', () => {
  expect(versCsv([{ ...c, nom: 'Le "Grand"' }]).split('\r\n')[1]?.startsWith('"Le ""Grand"""')).toBe(true)
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/features/communaute/lib` — Expected: FAIL.

- [ ] **Step 2: L'API, les fonctions pures, le hook**

`src/features/communaute/api/comptes.ts` :

```ts
/**
 * QUOI     — lit la liste des comptes (hub_comptes, mig 514).
 */
import { supabase } from '@/shared/supabase/client'

export type Filtre = 'tous' | 'nouveaux' | 'reactives' | 'sommeil' | 'porteurs' | 'equipe'
export type Tri = 'visite' | 'inscription' | 'nom'
export type Compte = {
  id: string; nom: string; email: string | null; avatar: string | null; role: string
  provenance: string | null; inscrit: string; derniere_visite: string | null; entree_v2: string | null
  client: boolean; departement: string | null; code: string | null; fragments: number
}
export type ListeDeComptes = {
  total: number
  compteurs: { comptes: number; actifs: number; reactives: number; sommeil: number }
  provenances: string[]
  departements: string[]
  lignes: Compte[]
}
export type Criteres = {
  filtre: Filtre; recherche: string; provenance: string | null; departement: string | null
  tri: Tri; limite: number; decalage: number
}

export async function lireComptes(c: Criteres): Promise<ListeDeComptes> {
  const { data, error } = await supabase.rpc('hub_comptes', {
    p_filtre: c.filtre, p_recherche: c.recherche, p_provenance: c.provenance ?? undefined,
    p_departement: c.departement ?? undefined, p_tri: c.tri, p_limite: c.limite, p_decalage: c.decalage,
  })
  if (error) throw error
  return data as ListeDeComptes
}
```

(Si le type généré refuse `undefined` pour un argument facultatif, passer la valeur telle quelle ; noter l'écart.)

`src/features/communaute/lib/balises.ts` :

```ts
/**
 * QUOI     — les balises d'un compte (spec §8, décisions d'Uriel du 14/10).
 * POURQUOI — fonction pure : chaque règle se teste seule.
 */
import type { Teinte } from '@/shared/ui/Balise'
import type { Compte } from '../api/comptes'

const JOUR = 24 * 3600_000
const QUINZE_JOURS = 15 * JOUR
const BASCULE = Date.parse('2026-10-07T00:00:00+02:00')

export function balisesDuCompte(c: Compte, maintenant: Date): { texte: string; teinte: Teinte }[] {
  const t = maintenant.getTime()
  const inscrit = Date.parse(c.inscrit)
  const entree = c.entree_v2 ? Date.parse(c.entree_v2) : null
  const balises: { texte: string; teinte: Teinte }[] = []
  if (c.role === 'admin') balises.push({ texte: 'Admin', teinte: 'admin' })
  if (t - inscrit < QUINZE_JOURS) balises.push({ texte: 'Nouveau', teinte: 'nouveau' })
  else if (entree !== null && t - entree < QUINZE_JOURS && entree - inscrit > JOUR) balises.push({ texte: 'Réactivé', teinte: 'reactive' })
  else if (entree === null && inscrit < BASCULE) balises.push({ texte: 'En sommeil', teinte: 'sommeil' })
  if (c.fragments > 0) balises.push({ texte: 'Porteur', teinte: 'porteur' })
  return balises
}
```

`src/features/communaute/lib/csv.ts` :

```ts
/**
 * QUOI     — la liste des comptes en CSV (séparateur « ; », que le tableur français ouvre sans question).
 */
import type { Compte } from '../api/comptes'

const COLONNES = ['nom', 'email', 'provenance', 'departement', 'fragments', 'inscrit', 'derniere_visite', 'role'] as const

function cellule(v: string | number | null): string {
  const s = v === null ? '' : String(v)
  return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

export function versCsv(lignes: Compte[]): string {
  return [COLONNES.join(';'), ...lignes.map((c) => COLONNES.map((k) => cellule(c[k])).join(';'))].join('\r\n')
}
```

`src/features/communaute/hooks/useComptes.ts` :

```ts
/**
 * QUOI     — la liste des comptes pour des critères donnés (gardée pendant qu'on change de page).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { lireComptes, type Criteres } from '../api/comptes'

export function useComptes(criteres: Criteres) {
  return useQuery({ queryKey: ['hub-comptes', criteres], queryFn: () => lireComptes(criteres), placeholderData: keepPreviousData })
}
```

Run: `pnpm --filter hub-v2 exec vitest run src/features/communaute/lib` — Expected: PASS.

- [ ] **Step 3: Écrire le test de l'écran (il échoue)**

`src/features/communaute/components/Comptes.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Comptes } from './Comptes'

const mockUseComptes = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useComptes', () => ({ useComptes: mockUseComptes }))

const liste = {
  total: 2,
  compteurs: { comptes: 4750, actifs: 312, reactives: 1412, sommeil: 2459 },
  provenances: ['app', 'flyer'], departements: ['Aude'],
  lignes: [
    { id: 'u1', nom: 'Kelpie', email: 'k@x.fr', avatar: null, role: 'user', provenance: 'flyer', inscrit: '2026-10-14T09:00:00Z',
      derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:00:00Z', client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2 },
    { id: 'u2', nom: 'Un Voyageur', email: null, avatar: null, role: 'user', provenance: null, inscrit: '2024-02-01T00:00:00Z',
      derniere_visite: null, entree_v2: null, client: false, departement: null, code: null, fragments: 0 },
  ],
}

function monter(adresse = '/communaute/comptes') {
  const router = createMemoryRouter([{ path: '/communaute/comptes', Component: Comptes }], { initialEntries: [adresse] })
  render(<RouterProvider router={router} />)
  return router
}

test('les quatre chiffres, les lignes et leurs balises', () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  monter()
  expect(screen.getByText('4 750')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Kelpie/ })).toHaveAttribute('href', '/communaute/comptes/u1')
  expect(screen.getByText('Seine-et-Marne (77)')).toBeInTheDocument()
  expect(screen.getByText('En sommeil')).toBeInTheDocument()
  expect(screen.getByText('jamais')).toBeInTheDocument()
})

test('le filtre va dans l’adresse et repart de la première page', async () => {
  mockUseComptes.mockReturnValue({ data: liste, isError: false })
  const router = monter('/communaute/comptes?page=2')
  await userEvent.click(screen.getByRole('radio', { name: 'En sommeil' }))
  expect(router.state.location.search).toBe('?filtre=sommeil')
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/features/communaute/components` — Expected: FAIL.

- [ ] **Step 4: L'écran et la ligne**

`src/features/communaute/components/LigneDeCompte.tsx` :

```tsx
/**
 * QUOI     — une ligne de la liste des comptes (maquette 594:961) : portrait, nom et balises, une
 *            ligne de détail, arrivé par, département, Fragments, dernière visite, inscription.
 */
import { Link } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import { depuis } from '@/shared/lib/quand'
import { moisAnnee } from '@/shared/lib/dates'
import { Balise } from '@/shared/ui/Balise'
import type { Compte } from '../api/comptes'
import { balisesDuCompte } from '../lib/balises'
import styles from './Communaute.module.css'

const PROVENANCES: Record<string, string> = { app: 'Appli', shopify: 'Boutique en ligne', stand: 'Stand', flyer: 'Flyer' }

export function LigneDeCompte({ compte, maintenant }: { compte: Compte; maintenant: Date }) {
  const detail = [compte.client ? 'client validé' : '', compte.email ?? ''].filter(Boolean).join(' · ')
  return (
    <Link className={styles.ligneCompte} to={`/communaute/comptes/${compte.id}`}>
      {compte.avatar ? <img className={styles.portrait} src={compte.avatar} alt="" loading="lazy" /> : <span className={styles.portrait} />}
      <span className={styles.qui}>
        <span className={styles.nomEtBalises}>
          <span className={styles.nom}>{compte.nom}</span>
          {balisesDuCompte(compte, maintenant).map((b) => <Balise key={b.texte} {...b} />)}
        </span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <span className={styles.colonne}>{compte.provenance ? (PROVENANCES[compte.provenance] ?? compte.provenance) : '—'}</span>
      <span className={styles.colonne}>{compte.departement ? `${compte.departement}${compte.code ? ` (${compte.code})` : ''}` : '—'}</span>
      <span className={styles.nombre}>{compte.fragments}</span>
      <span className={styles.colonne}>{compte.derniere_visite ? depuis(compte.derniere_visite, maintenant) : 'jamais'}</span>
      <span className={styles.colonne}>{moisAnnee(compte.inscrit)}</span>
      <img className={styles.chevron} src={chevron} alt="" />
    </Link>
  )
}
```

`src/features/communaute/components/Comptes.tsx` :

```tsx
/**
 * QUOI     — « Les comptes » (maquette 594:961) : quatre chiffres, filtres, recherche, la liste par
 *            pages, l'export CSV ; la fiche d'un compte s'ouvre par-dessus (route enfant).
 * POURQUOI — filtre, recherche, provenance, département, tri et page sont dans l'adresse.
 */
import { Outlet, useSearchParams } from 'react-router'
import { Bloc } from '@/shared/ui/Bloc'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { Pages } from '@/shared/ui/Pages'
import { Tuile } from '@/shared/ui/Tuile'
import { lireComptes, type Criteres, type Filtre, type Tri } from '../api/comptes'
import { useComptes } from '../hooks/useComptes'
import { versCsv } from '../lib/csv'
import { LigneDeCompte } from './LigneDeCompte'
import styles from './Communaute.module.css'

const PAR_PAGE = 50
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' }, { valeur: 'nouveaux', libelle: 'Nouveaux' }, { valeur: 'reactives', libelle: 'Réactivés' },
  { valeur: 'sommeil', libelle: 'En sommeil' }, { valeur: 'porteurs', libelle: 'Porteurs' }, { valeur: 'equipe', libelle: 'Équipe' },
]
const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: 'visite', libelle: 'Dernière visite' }, { valeur: 'inscription', libelle: 'Inscription' }, { valeur: 'nom', libelle: 'Nom' },
]
const nombre = new Intl.NumberFormat('fr-FR')

export function Comptes() {
  const [params, setParams] = useSearchParams()
  const criteres: Criteres = {
    filtre: FILTRES.find((f) => f.valeur === params.get('filtre'))?.valeur ?? 'tous',
    recherche: params.get('q') ?? '',
    provenance: params.get('provenance'),
    departement: params.get('departement'),
    tri: TRIS.find((t) => t.valeur === params.get('tri'))?.valeur ?? 'visite',
    limite: PAR_PAGE,
    decalage: Math.max(0, Number(params.get('page') ?? '1') - 1) * PAR_PAGE,
  }
  const { data, isError } = useComptes(criteres)
  const maintenant = new Date()

  function changer(cle: string, valeur: string | null) {
    const suivants = new URLSearchParams(params)
    if (valeur === null || valeur === '' || (cle === 'filtre' && valeur === 'tous') || (cle === 'tri' && valeur === 'visite')) suivants.delete(cle)
    else suivants.set(cle, valeur)
    if (cle !== 'page') suivants.delete('page')
    setParams(suivants)
  }

  async function exporter() {
    const tout = await lireComptes({ ...criteres, limite: 10000, decalage: 0 })
    const lien = document.createElement('a')
    lien.href = URL.createObjectURL(new Blob([`﻿${versCsv(tout.lignes)}`], { type: 'text/csv;charset=utf-8' }))
    lien.download = `comptes-${criteres.filtre}.csv`
    lien.click()
    URL.revokeObjectURL(lien.href)
  }

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Communauté"
        titre="Les comptes"
        phrase={data ? `${nombre.format(data.compteurs.comptes)} Explorateurs.` : undefined}
        aDroite={<button className={styles.boutonContour} type="button" onClick={() => void exporter()}>Exporter en CSV</button>}
      />
      {data && (
        <div className={styles.tuiles}>
          <Tuile libelle="Comptes" valeur={nombre.format(data.compteurs.comptes)} />
          <Tuile libelle="Actifs en 7 jours" valeur={nombre.format(data.compteurs.actifs)} />
          <Tuile libelle="Réactivés depuis la V2" valeur={nombre.format(data.compteurs.reactives)} />
          <Tuile libelle="En sommeil" valeur={nombre.format(data.compteurs.sommeil)} />
        </div>
      )}
      <div className={styles.barre}>
        <ChoixSegmente nom="Filtre" options={FILTRES} choisi={criteres.filtre} onChoix={(v) => { changer('filtre', v) }} />
        <select className={styles.choix} aria-label="Arrivés par" value={criteres.provenance ?? ''} onChange={(e) => { changer('provenance', e.target.value) }}>
          <option value="">Arrivés par : tous</option>
          {data?.provenances.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={styles.choix} aria-label="Département" value={criteres.departement ?? ''} onChange={(e) => { changer('departement', e.target.value) }}>
          <option value="">Département : tous</option>
          {data?.departements.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={styles.choix} aria-label="Trier" value={criteres.tri} onChange={(e) => { changer('tri', e.target.value) }}>
          {TRIS.map((t) => <option key={t.valeur} value={t.valeur}>{`Trier : ${t.libelle.toLowerCase()}`}</option>)}
        </select>
        <span className={styles.air} />
        <ChampDeRecherche valeur={criteres.recherche} onChange={(q) => { changer('q', q) }} etiquette="Un nom, un e-mail…" />
      </div>
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
      {data && (
        <Bloc>
          <div className={styles.entetesCompte} aria-hidden="true">
            <span /><span>Explorateur</span><span>Arrivé par</span><span>Département</span><span>Fragments</span><span>Dernière visite</span><span>Inscrit</span><span />
          </div>
          {data.lignes.map((c) => <LigneDeCompte key={c.id} compte={c} maintenant={maintenant} />)}
          {data.lignes.length === 0 && <p className={styles.calme}>Aucun compte ne correspond.</p>}
          <Pages total={data.total} decalage={criteres.decalage} parPage={PAR_PAGE} onDecalage={(d) => { changer('page', String(d / PAR_PAGE + 1)) }} />
        </Bloc>
      )}
      <Outlet />
    </div>
  )
}
```

`src/features/communaute/components/Communaute.module.css` (partagé par les quatre écrans ; les tailles et couleurs sont celles des maquettes 594:961 et 595:1140) :

```css
/*
 * QUOI     — la mise en page des écrans de la Communauté : listes en grille sur PC, compactes au téléphone.
 */
.ecran { display: grid; gap: var(--space-6); }
.tuiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.barre { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
.air { flex: 1; }
.calme { margin: 0; padding: var(--space-3) var(--space-4); color: var(--color-texte-doux); }

.choix, .boutonContour {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--color-bord);
  border-radius: var(--radius-rond);
  background: none;
  font-family: var(--font-condensee);
  font-weight: var(--weight-gras);
  font-size: var(--sous-titre-size);
  color: var(--color-texte);
}

.entetesCompte { display: none; }

.ligneCompte {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  grid-template-areas: 'portrait qui chevron';
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: inherit;
  text-decoration: none;
  transition: background var(--duree-douce) var(--courbe-douce);
}
.ligneCompte:hover { background: var(--color-surface); }
.portrait { grid-area: portrait; width: 32px; height: 32px; border-radius: var(--radius-rond); background: var(--color-vignette); object-fit: cover; }
.qui { grid-area: qui; display: grid; min-width: 0; }
.nomEtBalises { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.nom { font-weight: var(--weight-semi); color: var(--color-encre); }
.detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--legende-size); color: var(--color-texte-doux); }
.colonne, .nombre { display: none; font-size: var(--flux-size); color: var(--color-texte); }
.chevron { grid-area: chevron; width: 16px; opacity: 0.5; }

@container app (width >= 900px) {
  .tuiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .entetesCompte, .ligneCompte {
    grid-template-columns: 32px minmax(0, 1fr) 170px 150px 70px 120px 90px 16px;
    grid-template-areas: none;
  }
  .entetesCompte {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) var(--space-2);
    font-family: var(--font-condensee);
    font-weight: var(--weight-gras);
    font-size: var(--micro-size);
    letter-spacing: var(--pilule-tracking);
    text-transform: uppercase;
    color: var(--color-texte-pale);
  }
  .portrait, .qui, .chevron { grid-area: auto; }
  .colonne, .nombre { display: block; }
  .nombre { text-align: center; color: var(--color-encre); }
}
```

`src/features/communaute/README.md` : `La Communauté du Hub (spec §11) : api/ (hub_comptes, hub_compte, hub_compagnies…, hub_lieux, mod_*), hooks/, lib/ (balises, csv, couleur, raisons), components/ (un écran et sa fiche par menu).`

`src/app/router.tsx` : importer `Comptes` et, dans `children` de `/`, ajouter avant `...autres` :

```tsx
{ path: 'communaute/comptes', Component: Comptes, children: [{ path: ':id', Component: TiroirCompte }] },
```

et retirer `/communaute/comptes` des `autres` : `.filter((l) => l.chemin !== '/' && !ECRANS_FAITS.has(l.chemin))` avec `const ECRANS_FAITS = new Set(['/communaute/comptes'])` (étendu par les tâches suivantes). Tant que `TiroirCompte` n'existe pas (Task 4), mettre `children: []`.

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/hub-v2/src
git commit -m "feat(hub-v2): l'écran des comptes"
```

---

### Task 4: La fiche d'un compte (tiroir)

**Files:**
- Create: `src/features/communaute/hooks/useCompte.ts`, `components/TiroirCompte.tsx`, `components/TiroirCompte.test.tsx`
- Modify: `src/features/communaute/api/comptes.ts` (ajouts), `src/features/communaute/components/Communaute.module.css` (ajouts), `src/app/router.tsx`

**Interfaces:**
- Consumes: `hub_compte` (Task 1), RPC existante `changer_role(p_user text, p_role text)` (mig 499 ; une autre surcharge à 3 arguments existe pour les rôles de Compagnie : appeler avec les noms `p_user`, `p_role`) ; `Tiroir` (Task 2) ; `balisesDuCompte` (Task 3).
- Produces: `type FicheDeCompte` ; `lireCompte(id): Promise<FicheDeCompte | null>` ; `changerRole(id, role): Promise<void>`.

- [ ] **Step 1: Écrire le test (il échoue)**

`src/features/communaute/components/TiroirCompte.test.tsx` :

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { TiroirCompte } from './TiroirCompte'

const mockUseCompte = vi.hoisted(() => vi.fn())
const mockChanger = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useCompte', () => ({ useCompte: mockUseCompte }))
vi.mock('../api/comptes', async (orig) => ({ ...(await orig<typeof import('../api/comptes')>()), changerRole: mockChanger }))

const fiche = {
  id: 'u1', nom: 'Kelpie', email: 'k@x.fr', avatar: null, role: 'user', provenance: 'flyer', inscrit: '2026-10-14T09:00:00Z',
  derniere_visite: '2026-10-14T11:00:00Z', entree_v2: '2026-10-14T09:00:00Z', client: true, departement: 'Seine-et-Marne', code: '77', fragments: 2,
  compteurs: { decouverts: 12, visites: 4, ajoutes: 0, enigmes: 3 },
}

function monter() {
  const router = createMemoryRouter(
    [{ path: '/communaute/comptes', element: <p>La liste</p> }, { path: '/communaute/comptes/:id', Component: TiroirCompte }],
    { initialEntries: ['/communaute/comptes/u1'] },
  )
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
}

test('la fiche : identité, balises, parcours, compteurs', () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [{ id: 7, nom: 'Hoplite', image: null, source: 'shopify', quand: '2026-10-14T10:00:00Z' }], achats: [], traces: [] }, isPending: false })
  monter()
  expect(screen.getByRole('dialog', { name: 'Kelpie' })).toBeInTheDocument()
  expect(screen.getByText('Porteur')).toBeInTheDocument()
  expect(screen.getByText('Seine-et-Marne (77)')).toBeInTheDocument()
  expect(screen.getByText('Hoplite')).toBeInTheDocument()
})

test('un compte inconnu : « Compte introuvable » et un lien vers la liste', () => {
  mockUseCompte.mockReturnValue({ data: null, isPending: false })
  monter()
  expect(screen.getByText('Compte introuvable.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Retour à la liste' })).toHaveAttribute('href', '/communaute/comptes')
})

test('changer le rôle appelle changer_role', async () => {
  mockUseCompte.mockReturnValue({ data: { ...fiche, fragments: [], achats: [], traces: [] }, isPending: false })
  mockChanger.mockResolvedValue(undefined)
  monter()
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Rôle' }), 'moderator')
  expect(mockChanger).toHaveBeenCalledWith('u1', 'moderator')
})
```

(Dans la fiche, `fragments` est une liste — elle remplace le nombre de la liste des comptes ; voir `FicheDeCompte` ci-dessous. Chaque test la redonne.)

Run: `pnpm --filter hub-v2 exec vitest run src/features/communaute/components/TiroirCompte.test.tsx` — Expected: FAIL.

- [ ] **Step 2: API, hook, tiroir**

Ajouter à `src/features/communaute/api/comptes.ts` :

```ts
export type FicheDeCompte = Omit<Compte, 'fragments'> & {
  compteurs: { decouverts: number; visites: number; ajoutes: number; enigmes: number }
  fragments: { id: number; nom: string | null; image: string | null; source: string; quand: string | null }[]
  achats: { commande: string | null; quand: string | null; statut: string; tag: string | null }[]
  traces: { type: 'visite' | 'decouverte' | 'ajout' | 'enigme' | 'enigme_manquee'; quand: string; texte: string }[]
}

export async function lireCompte(id: string): Promise<FicheDeCompte | null> {
  const { data, error } = await supabase.rpc('hub_compte', { p_id: id })
  if (error) throw error
  return data as FicheDeCompte | null
}

export async function changerRole(id: string, role: string): Promise<void> {
  const { error } = await supabase.rpc('changer_role', { p_user: id, p_role: role })
  if (error) throw error
}
```

`hub_compte` renvoie `fragments` comme une liste (elle remplace le nombre de la base) : c'est ce que dit `FicheDeCompte`. Pour les balises, la fiche passe `{ ...fiche, fragments: fiche.fragments.length }` à `balisesDuCompte`.

`src/features/communaute/hooks/useCompte.ts` :

```ts
/**
 * QUOI     — la fiche d'un compte, et le changement de rôle qui la rafraîchit avec la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changerRole, lireCompte } from '../api/comptes'

export function useCompte(id: string) {
  return useQuery({ queryKey: ['hub-compte', id], queryFn: () => lireCompte(id) })
}

export function useChangerRole(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (role: string) => changerRole(id, role),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hub-compte', id] })
      void client.invalidateQueries({ queryKey: ['hub-comptes'] })
    },
  })
}
```

(Le test simule `useCompte` seul : `useChangerRole` appelle la vraie fonction `changerRole`, simulée par `mockChanger`.)

`src/features/communaute/components/TiroirCompte.tsx` — la fiche de la maquette 595:1140 :
- `const { id = '' } = useParams()` ; `const { data, isPending } = useCompte(id)` ; `const changer = useChangerRole(id)`.
- `isPending` → `<Tiroir titre="Compte" retour="/communaute/comptes"><p className={styles.calme}>Lecture…</p></Tiroir>`.
- `data === null` → `<Tiroir titre="Compte introuvable" retour="/communaute/comptes"><p>Compte introuvable.</p><Link to="/communaute/comptes">Retour à la liste</Link></Tiroir>`.
- Sinon, dans `<Tiroir titre={data.nom} retour="/communaute/comptes">` :
  1. **Identité** : portrait 72 px (ou un rond `--color-vignette`), le nom en Bebas (`--titre-section-size`), les balises (`balisesDuCompte({ ...data, fragments: data.fragments.length }, new Date())`), « Inscrit le {dateCourte(inscrit)} · vu {depuis(derniere_visite) ou 'jamais'} ».
  2. **Son parcours** (`TitreDeSection` + `Bloc`, une ligne clé/valeur par entrée) : Arrivé par (`PROVENANCES`) · Département (`Nom (code)` ou « — ») · Boutique (« Client validé · N commandes » ou « — », N = `achats.length`) · E-mail · Rôle : un `<select aria-label="Rôle">` avec `user` « Explorateur », `ambassador` « Ambassadeur », `moderator` « Modérateur », `admin` « Admin », dont `onChange` appelle `changer.mutate(e.target.value)` ; pendant `changer.isPending` le select est désactivé ; `changer.isError` affiche « Le rôle n’a pas changé. ».
  3. **Ce qu'il a fait** : quatre `Tuile` (Découverts, Visites, Ajoutés, Énigmes) en grille de 4.
  4. **Ses Fragments** : `Bloc` d'une ligne par Fragment (vignette 34 px `--radius-petit` de `image` si présente, nom, « débloqué par une commande » si `source === 'shopify'`, « associé à la main » si `manual`, puis la date) ; vide → « Aucun Fragment. ».
  5. **Ses achats** : `Bloc` d'une ligne par achat (« Commande n° {commande} », date, une `Balise` « Débloqué » teinte `visite` si `statut === 'unlocked'`, sinon le statut en teinte `boutique`) ; vide → « Aucun achat. ».
  6. **Ses dernières traces** : `Bloc` de lignes « {heureDuFil(quand)} · {libellé du type} {texte} » avec les libellés `visite` « a posé sa marque à », `decouverte` « a découvert », `ajout` « a ajouté », `enigme` « a percé l’», `enigme_manquee` « a manqué l’» ; vide → « Aucune trace. ».
- Ajouter à `Communaute.module.css` les classes de la fiche (`.identite`, `.grandPortrait`, `.nomFiche`, `.parcours` en grille `120px 1fr`, `.quatre` grille de 4, `.vignette`), toutes en jetons.

`src/app/router.tsx` : `children: [{ path: ':id', Component: TiroirCompte }]` pour la route des comptes.

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/hub-v2/src
git commit -m "feat(hub-v2): la fiche d'un compte, son rôle"
```

---

### Task 5: Les Compagnies — migration 515, la liste, la fiche modifiable

**Files:**
- Create: `supabase/migrations/515_hub_compagnies.sql`
- Create: `src/features/communaute/api/compagnies.ts`, `hooks/useCompagnies.ts`, `hooks/useCompagnie.ts`, `lib/couleur.ts`, `lib/couleur.test.ts`, `components/Compagnies.tsx`, `components/TiroirCompagnie.tsx`, `components/Compagnies.test.tsx`
- Modify: `src/app/router.tsx`, `apps/hub-v2/src/shared/supabase/database.types.ts` (régénéré)

**Interfaces:**
- Produces (SQL) :
  - `hub_compagnies() returns jsonb` — `[{ id, nom, couleur, devise, privee, retiree, membres, chef, fondee }]` triées : actives d'abord, puis par nombre de membres décroissant.
  - `hub_compagnie(p_id text) returns jsonb` — `null` si inconnue, sinon `{ id, nom, couleur, devise, mission, avatar, privee, retiree, fondee, membres: [{ id, nom, avatar, role, depuis }] }` (membres triés chef, officiers, membres, puis par date d'arrivée).
  - `hub_modifier_compagnie(p_id text, p_nom text, p_devise text, p_mission text, p_couleur text) returns void` — refus « Réservé à l’équipe » ; « Compagnie introuvable » ; « Le nom fait 2 à 40 signes » ; « La devise fait 80 signes au plus » ; « La présentation fait 500 signes au plus » ; « La couleur est un code #RRGGBB » ; « Ce nom est déjà pris » (parmi les Compagnies non retirées, insensible à la casse) ; met à jour `factions.title`, `devise`, `description`, `color`, `updated_at`.
- Produces (TS) : `couleurValide(c: string): boolean` ; `type Compagnie`, `type FicheDeCompagnie` ; `lireCompagnies()`, `lireCompagnie(id)`, `modifierCompagnie(id, champs)`.

- [ ] **Step 1: Relever les colonnes live** (lecture seule)

```bash
npx supabase db query --linked "select table_name, column_name from information_schema.columns where table_schema='public' and (table_name, column_name) in (('factions','id'),('factions','title'),('factions','color'),('factions','devise'),('factions','description'),('factions','image_url'),('factions','privee'),('factions','retired'),('factions','created_at'),('factions','updated_at'),('faction_members','faction_id'),('faction_members','user_id'),('faction_members','role'),('faction_members','joined_at')) order by 1,2"
```

Expected : les 14 couples.

- [ ] **Step 2: La migration**

```sql
-- WHY: Hub V2, plan 2 (spec §11) : les Compagnies vues par l'équipe — la liste de toutes (retirées
--      comprises), la fiche avec ses membres (même privée), et la modification de son identité (nom,
--      couleur, devise, présentation) par un admin qui n'en est pas Chef : modifier_compagnie exige un
--      rôle dans la Compagnie. Mêmes règles de forme que _verifier_fiche (2-40, 80, 500, #RRGGBB).
--      Jamais l'identifiant (rename_faction est fermée, mig 512).
-- SCHEMA CHECKED (14/10/2026, information_schema live) : factions(id, title, color, devise,
--   description, image_url, privee, retired, created_at, updated_at) ; faction_members(faction_id,
--   user_id, role, joined_at) ; _is_admin(), _refus().

CREATE OR REPLACE FUNCTION public.hub_compagnies()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(c ORDER BY (c->>'retiree')::boolean, (c->>'membres')::int DESC, c->>'nom')
      FROM (
        SELECT jsonb_build_object(
          'id', f.id, 'nom', f.title, 'couleur', f.color, 'devise', f.devise,
          'privee', COALESCE(f.privee, false), 'retiree', COALESCE(f.retired, false), 'fondee', f.created_at,
          'membres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
          'chef', (SELECT COALESCE(u.display_name, u.first_name, 'Un Voyageur')
                     FROM faction_members m JOIN users u ON u.id = m.user_id
                    WHERE m.faction_id = f.id AND m.role = 'chef' LIMIT 1)) AS c
          FROM factions f) x), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compagnies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compagnies() TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_compagnie(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  SELECT jsonb_build_object(
           'id', f.id, 'nom', f.title, 'couleur', f.color, 'devise', f.devise, 'mission', f.description,
           'avatar', f.image_url, 'privee', COALESCE(f.privee, false), 'retiree', COALESCE(f.retired, false),
           'fondee', f.created_at,
           'membres', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
                      'id', u.id, 'nom', COALESCE(u.display_name, u.first_name, 'Un Voyageur'),
                      'avatar', u.avatar_url, 'role', m.role, 'depuis', m.joined_at)
                    ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at)
               FROM faction_members m JOIN users u ON u.id = m.user_id
              WHERE m.faction_id = f.id), '[]'::jsonb))
    INTO v
    FROM factions f WHERE f.id = p_id;
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_compagnie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_compagnie(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hub_modifier_compagnie(p_id text, p_nom text, p_devise text, p_mission text, p_couleur text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nom text := btrim(COALESCE(p_nom, ''));
  v_devise text := NULLIF(btrim(COALESCE(p_devise, '')), '');
  v_mission text := NULLIF(btrim(COALESCE(p_mission, '')), '');
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = p_id) THEN PERFORM _refus('Compagnie introuvable', 'compagnie'); END IF;
  IF char_length(v_nom) NOT BETWEEN 2 AND 40 THEN PERFORM _refus('Le nom fait 2 à 40 signes', 'nom'); END IF;
  IF char_length(COALESCE(v_devise, '')) > 80 THEN PERFORM _refus('La devise fait 80 signes au plus', 'devise'); END IF;
  IF char_length(COALESCE(v_mission, '')) > 500 THEN PERFORM _refus('La présentation fait 500 signes au plus', 'mission'); END IF;
  IF p_couleur IS NULL OR p_couleur !~ '^#[0-9a-fA-F]{6}$' THEN PERFORM _refus('La couleur est un code #RRGGBB', 'couleur'); END IF;
  IF EXISTS (SELECT 1 FROM factions WHERE id <> p_id AND NOT COALESCE(retired, false) AND lower(title) = lower(v_nom)) THEN
    PERFORM _refus('Ce nom est déjà pris', 'nom');
  END IF;
  UPDATE factions SET title = v_nom, devise = v_devise, description = v_mission, color = p_couleur, updated_at = now()
   WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_modifier_compagnie(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_modifier_compagnie(text, text, text, text, text) TO authenticated;
```

- [ ] **Step 3: Appliquer, vérifier, types**

```bash
npx supabase db push --dry-run --linked     # seule 515, sinon STOP
npx supabase db push --linked
npx supabase db query --linked "select has_function_privilege('anon','public.hub_modifier_compagnie(text,text,text,text,text)','execute') as anon"
npx supabase db query --linked "select public.hub_compagnies()"
```

Expected : `anon = false` ; le dernier appel refusé (« Réservé à l’équipe »). Puis `pnpm gen:types` (dans `apps/hub-v2`).

- [ ] **Step 4: Tests (ils échouent)**

`src/features/communaute/lib/couleur.test.ts` :

```ts
import { couleurValide } from './couleur'

test('un code #RRGGBB', () => {
  expect(couleurValide('#a94842')).toBe(true)
  expect(couleurValide('#A94842')).toBe(true)
})
test('le reste est refusé', () => {
  for (const c of ['a94842', '#a948', '#a94842ff', 'rouge', '']) expect(couleurValide(c)).toBe(false)
})
```

`src/features/communaute/components/Compagnies.test.tsx` :

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Compagnies } from './Compagnies'
import { TiroirCompagnie } from './TiroirCompagnie'

const api = vi.hoisted(() => ({ lireCompagnies: vi.fn(), lireCompagnie: vi.fn(), modifierCompagnie: vi.fn() }))
vi.mock('../api/compagnies', () => api)

const cairns = { id: 'cairns', nom: 'Compagnie des Cairns', couleur: '#46493c', devise: 'Pierre sur pierre', privee: false, retiree: false, membres: 12, chef: 'Ombre', fondee: '2026-06-24T10:00:00Z' }

function monter(adresse: string) {
  const router = createMemoryRouter(
    [{ path: '/communaute/compagnies', Component: Compagnies, children: [{ path: ':id', Component: TiroirCompagnie }] }],
    { initialEntries: [adresse] },
  )
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>)
}

test('la liste des Compagnies', async () => {
  api.lireCompagnies.mockResolvedValue([cairns, { ...cairns, id: 'old', nom: 'Les Anciens', retiree: true, membres: 0, chef: null }])
  monter('/communaute/compagnies')
  expect(await screen.findByRole('link', { name: /Compagnie des Cairns/ })).toHaveAttribute('href', '/communaute/compagnies/cairns')
  expect(screen.getByText('Retirée')).toBeInTheDocument()
})

test('un nom pris : le message s’affiche, la saisie reste', async () => {
  api.lireCompagnies.mockResolvedValue([cairns])
  api.lireCompagnie.mockResolvedValue({ ...cairns, mission: 'Bâtir.', avatar: null, membres: [] })
  api.modifierCompagnie.mockRejectedValue(new Error('Ce nom est déjà pris'))
  monter('/communaute/compagnies/cairns')
  const nom = await screen.findByRole('textbox', { name: 'Nom' })
  await userEvent.clear(nom)
  await userEvent.type(nom, 'Les Veilleurs')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(await screen.findByText('Ce nom est déjà pris')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('Les Veilleurs')
})

test('une couleur invalide est refusée avant d’envoyer', async () => {
  api.lireCompagnies.mockResolvedValue([cairns])
  api.lireCompagnie.mockResolvedValue({ ...cairns, mission: '', avatar: null, membres: [] })
  monter('/communaute/compagnies/cairns')
  const couleur = await screen.findByRole('textbox', { name: 'Couleur' })
  await userEvent.clear(couleur)
  await userEvent.type(couleur, 'rouge')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(screen.getByText('La couleur est un code #RRGGBB')).toBeInTheDocument()
  expect(api.modifierCompagnie).not.toHaveBeenCalled()
})
```

Run: `pnpm --filter hub-v2 exec vitest run src/features/communaute` — Expected: FAIL (modules introuvables).

- [ ] **Step 5: Code**

`src/features/communaute/lib/couleur.ts` :

```ts
/** QUOI — une couleur de Compagnie : un code #RRGGBB (la même règle que la base, mig 515). */
export function couleurValide(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c)
}
```

`src/features/communaute/api/compagnies.ts` :

```ts
/**
 * QUOI     — les Compagnies vues par l'équipe (hub_compagnies, hub_compagnie, hub_modifier_compagnie, mig 515).
 * ATTENTION — l'erreur de la base porte le message à montrer (« Ce nom est déjà pris »…) : on le garde.
 */
import { supabase } from '@/shared/supabase/client'

export type Compagnie = {
  id: string; nom: string; couleur: string; devise: string | null; privee: boolean; retiree: boolean
  membres: number; chef: string | null; fondee: string | null
}
export type Membre = { id: string; nom: string; avatar: string | null; role: 'chef' | 'officier' | 'membre'; depuis: string | null }
export type FicheDeCompagnie = Omit<Compagnie, 'membres' | 'chef'> & { mission: string | null; avatar: string | null; membres: Membre[] }
export type Identite = { nom: string; devise: string; mission: string; couleur: string }

export async function lireCompagnies(): Promise<Compagnie[]> {
  const { data, error } = await supabase.rpc('hub_compagnies')
  if (error) throw error
  return data as Compagnie[]
}

export async function lireCompagnie(id: string): Promise<FicheDeCompagnie | null> {
  const { data, error } = await supabase.rpc('hub_compagnie', { p_id: id })
  if (error) throw error
  return data as FicheDeCompagnie | null
}

export async function modifierCompagnie(id: string, i: Identite): Promise<void> {
  const { error } = await supabase.rpc('hub_modifier_compagnie', { p_id: id, p_nom: i.nom, p_devise: i.devise, p_mission: i.mission, p_couleur: i.couleur })
  if (error) throw new Error(error.message)
}
```

`src/features/communaute/hooks/useCompagnies.ts` et `useCompagnie.ts` : `useQuery({ queryKey: ['hub-compagnies'], queryFn: lireCompagnies })` ; `useQuery({ queryKey: ['hub-compagnie', id], queryFn: () => lireCompagnie(id) })` et `useModifierCompagnie(id)` = `useMutation({ mutationFn: (i: Identite) => modifierCompagnie(id, i), onSuccess: () => { invalider ['hub-compagnie', id] et ['hub-compagnies'] } })`.

`src/features/communaute/components/Compagnies.tsx` : `EnTeteDePage surtitre="Communauté" titre="Les Compagnies" phrase="{n} Compagnies actives, {m} membres."` ; un `Bloc` d'une ligne par Compagnie, chaque ligne un `Link` vers `/communaute/compagnies/{id}` : une pastille ronde 28 px de la couleur de la Compagnie (`style={{ '--couleur': c.couleur }}` et `background: var(--couleur)` dans le CSS — c'est la seule valeur inline permise, une variable), le nom en gras, la devise en dessous, puis « {membres} membres », « Chef : {chef ?? '—'} », une `Balise` « Privée » (teinte `boutique`) si `privee`, « Retirée » (teinte `sommeil`) si `retiree`, le chevron. Puis `<Outlet />`. Ajouter `--couleur` à la liste des variables posées en ligne si un test des variables existe dans le Hub (sinon rien).

`src/features/communaute/components/TiroirCompagnie.tsx` : `Tiroir titre={fiche.nom} retour="/communaute/compagnies"` ; `null` → « Compagnie introuvable. » et un lien « Retour à la liste » (comme TiroirCompte) ; sinon :
1. Identité : la pastille de couleur 56 px, le nom en Bebas, « Fondée le {dateCourte(fondee)} », les balises Privée/Retirée.
2. **Son identité** — un formulaire (`TitreDeSection` + `Bloc`) : quatre champs étiquetés **Nom** (`input`), **Devise** (`input`), **Présentation** (`textarea`), **Couleur** (`input` texte, à côté un aperçu rond de la couleur saisie), initialisés depuis la fiche (un `useState` par champ) ; « Enregistrer » : si `!couleurValide(couleur)` → message « La couleur est un code #RRGGBB » sans envoyer ; sinon `modifier.mutate(...)` ; en erreur, le message de l'erreur (`modifier.error.message`) sous le bouton ; en succès, « Enregistré. » qui s'efface après 3 s. L'identifiant n'est jamais modifiable : l'afficher en petit, « Identifiant : {id} ».
3. **Ses membres** : `Bloc` d'une ligne par membre (portrait 28 px, nom, le rôle en `Balise` — Chef teinte `admin`, Officier `porteur`, Membre `boutique` —, « depuis {moisAnnee(depuis)} », et un `Link` vers `/communaute/comptes/{id}`) ; vide → « Aucun membre. ».

`src/app/router.tsx` : ajouter `{ path: 'communaute/compagnies', Component: Compagnies, children: [{ path: ':id', Component: TiroirCompagnie }] }` et `'/communaute/compagnies'` à `ECRANS_FAITS`.

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/515_hub_compagnies.sql apps/hub-v2/src
git commit -m "feat(hub-v2): les Compagnies — la liste, la fiche, l'identité modifiable"
```

---

### Task 6: Les lieux à modérer — migration 516, la liste, la fiche de modération

**Files:**
- Create: `supabase/migrations/516_hub_lieux.sql`
- Create: `src/features/communaute/api/lieux.ts`, `hooks/useLieux.ts`, `hooks/useLieu.ts`, `components/Lieux.tsx`, `components/TiroirLieu.tsx`, `components/Lieux.test.tsx`
- Modify: `src/app/router.tsx`, `database.types.ts` (régénéré)

**Interfaces:**
- Produces (SQL) : `hub_lieux(p_filtre text, p_recherche text, p_nature text, p_limite integer, p_decalage integer) returns jsonb` — la même sortie que `mod_list_places` (`{total, rows: [...]}`, mêmes clés par ligne), réservée aux admins, avec les filtres `a_moderer` (non masqués, jamais vérifiés, ajoutés depuis le 07/10/2026 — la définition de la pastille), `verifies`, `masques`, `tous`, et une recherche sans joker.
- Consumes (existants, `_is_staff(_caller_user_id())`, erreurs en JSON `{error}`) : `mod_get_place(p_place_id text)`, `mod_update_place(p_place_id text, p_title text, p_text text, p_sensible boolean)`, `mod_set_place_tags(p_place_id text, p_tag_ids text[])` (1 à 3 natures, la première principale), `mod_set_verified(p_place_id text, p_verified boolean)`, `mod_set_masked(p_place_id text, p_masked boolean)` ; la table `tags` (lisible par tout compte : `id, title, color, background, order`).
- Produces (TS) : `type LigneDeLieu`, `type FicheDeLieu`, `lireLieux(criteres)`, `lireLieu(id)`, `lireNatures()`, `modifierLieu(id, champs)`, `changerNatures(id, ids)`, `verifierLieu(id, oui)`, `masquerLieu(id, oui)` — chacune lève une `Error` si la réponse porte `error`.

- [ ] **Step 1: Copier la définition live de `mod_list_places`**

```bash
npx supabase db query --linked "select pg_get_functiondef('public.mod_list_places(text,text,text,integer,integer)'::regprocedure)"
```

- [ ] **Step 2: La migration** — `516_hub_lieux.sql` :
  - En-tête `-- WHY:` : « Hub V2, plan 2 : la liste des lieux à modérer. mod_list_places filtre les "non vérifiés" sur tout l'historique (3 508 lieux) alors que la pastille du menu compte ceux depuis la bascule (12 au 14/10) : la liste doit dire la même chose que la pastille. Corps repris de la définition live de mod_list_places ; changent seulement le nom, la garde (_is_admin), les filtres (a_moderer, verifies, masques, tous) et la recherche (position, sans joker) ; le filtre par nature garde le paramètre p_nature (id de tag). » + `-- SCHEMA CHECKED (14/10/2026, live) : pg_get_functiondef de mod_list_places copiée entière.`
  - `CREATE OR REPLACE FUNCTION public.hub_lieux(p_filtre text DEFAULT 'a_moderer', p_recherche text DEFAULT NULL, p_nature text DEFAULT NULL, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0) RETURNS json` : le corps de `mod_list_places` où :
    - la garde devient `IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;` et `IF p_filtre NOT IN ('a_moderer','verifies','masques','tous') THEN PERFORM _refus('Filtre inconnu', 'filtre'); END IF;` ;
    - la condition de filtre devient : `a_moderer` → `p.masked = false AND p.verified_at IS NULL AND p.created_at >= '2026-10-07'::timestamptz` ; `verifies` → `p.masked = false AND p.verified_at IS NOT NULL` ; `masques` → `p.masked = true` ; `tous` → `true` ;
    - la recherche devient `(NULLIF(lower(btrim(p_search_param)),'') IS NULL OR position(lower(btrim(p_recherche)) IN lower(p.title)) > 0)` ;
    - le paramètre de nature remplace `p_tag_id` à l'identique ;
    - l'ordre, la pagination et la forme de sortie (`{total, rows}`) restent ceux de la définition live.
  - `REVOKE ALL ON FUNCTION public.hub_lieux(text, text, text, integer, integer) FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated;`
  - Appliquer (dry-run : seule 516), vérifier `anon=false` et le refus sans session, régénérer les types.
  - Vérifier en lecture seule que le filtre dit la même chose que la pastille : `select count(*) from places where masked = false and verified_at is null and created_at >= '2026-10-07'` = la valeur `attente.lieux` de l'ouverture (12 le 14/10).

- [ ] **Step 3: Test (il échoue)** — `src/features/communaute/components/Lieux.test.tsx` :

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Lieux } from './Lieux'
import { TiroirLieu } from './TiroirLieu'

const api = vi.hoisted(() => ({
  lireLieux: vi.fn(), lireLieu: vi.fn(), lireNatures: vi.fn(), modifierLieu: vi.fn(),
  changerNatures: vi.fn(), verifierLieu: vi.fn(), masquerLieu: vi.fn(),
}))
vi.mock('../api/lieux', () => api)

const ligne = { id: 'p1', title: 'Dolmen de la Pierre Levée', address: 'Aude', masked: false, sensible: false, created_at: '2026-10-14T09:02:00Z',
  verified_at: null, author_name: 'Luna', verified_by_name: null, photo_count: 3, thumb_url: null, visit_count: 0,
  tags: [{ id: 'dolmens', title: 'Dolmens et mégalithes', color: '#fff', background: '#a94842', is_primary: true }] }

function monter(adresse: string) {
  const client = new QueryClient()
  const router = createMemoryRouter(
    [{ path: '/communaute/lieux', Component: Lieux, children: [{ path: ':id', Component: TiroirLieu }] }],
    { initialEntries: [adresse] },
  )
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return client
}

test('par défaut : à modérer', async () => {
  api.lireLieux.mockResolvedValue({ total: 1, rows: [ligne] })
  monter('/communaute/lieux')
  expect(await screen.findByRole('link', { name: /Dolmen de la Pierre Levée/ })).toHaveAttribute('href', '/communaute/lieux/p1')
  expect(api.lireLieux).toHaveBeenCalledWith(expect.objectContaining({ filtre: 'a_moderer' }))
})

test('masquer un lieu rafraîchit la liste et la pastille', async () => {
  api.lireLieux.mockResolvedValue({ total: 1, rows: [ligne] })
  api.lireNatures.mockResolvedValue([{ id: 'dolmens', title: 'Dolmens et mégalithes', color: '#fff', background: '#a94842' }])
  api.lireLieu.mockResolvedValue({ ...ligne, text: 'Un dolmen.', images: [], visit_count: 0, discovered_count: 2, author_places_count: 31 })
  api.masquerLieu.mockResolvedValue(undefined)
  const client = monter('/communaute/lieux/p1')
  const invalider = vi.spyOn(client, 'invalidateQueries')
  await userEvent.click(await screen.findByRole('button', { name: 'Masquer le lieu' }))
  expect(api.masquerLieu).toHaveBeenCalledWith('p1', true)
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-lieux'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-ouverture'] })
})
```

- [ ] **Step 4: Code**
  - `api/lieux.ts` : les types `LigneDeLieu` (clés de `rows`), `FicheDeLieu` (clés de `mod_get_place` : `id, title, text, address, latitude, longitude, masked, sensible, created_at, verified_at, verified_by_name, author_id, author_name, author_places_count, visit_count, discovered_count, photo_count, images: { url: string; thumb: string | null }[]`), `Nature` (`id, title, color, background`) ; `lireLieux({ filtre, recherche, nature, limite, decalage })` → `rpc('hub_lieux', …)` ; `lireLieu(id)` → `rpc('mod_get_place', { p_place_id: id })` (si `data.error === 'place_not_found'` → `null`, autre `error` → `throw new Error(...)`) ; `lireNatures()` → `from('tags').select('id, title, color, background').order('order')` ; `modifierLieu(id, { titre, texte, sensible })` → `mod_update_place` ; `changerNatures(id, ids)` → `mod_set_place_tags` ; `verifierLieu(id, oui)` → `mod_set_verified` ; `masquerLieu(id, oui)` → `mod_set_masked`. Chaque écriture lève une `Error` si la réponse JSON porte `error` (« not_staff » → « Réservé à l’équipe »).
  - `hooks/useLieux.ts` : `useQuery(['hub-lieux', criteres], …, keepPreviousData)` ; `hooks/useLieu.ts` : `useLieu(id)`, `useNatures()`, et `useModeration(id)` qui expose quatre mutations ; chacune, en succès, invalide `['hub-lieu', id]`, `['hub-lieux']` et `['hub-ouverture']` (la pastille du menu).
  - `components/Lieux.tsx` : `EnTeteDePage surtitre="Communauté" titre="Les lieux à modérer" phrase="{total} lieux dans cette vue."` ; filtres `ChoixSegmente` À modérer (`a_moderer`, défaut) · Vérifiés · Masqués · Tous ; un `select` des natures ; `ChampDeRecherche` « Un nom de lieu… » ; tout dans l'adresse (`filtre`, `nature`, `q`, `page`) comme les comptes ; `Bloc` d'une ligne par lieu (`Link` vers `/communaute/lieux/{id}`) : vignette 52 px `--radius-petit` (`thumb_url`, sinon le fond `--color-vignette`), le nom en gras, la nature principale en `Balise` teinte `lieu`, « par {author_name} · {depuis(created_at)} · {address} », à droite « {visit_count} visites · {photo_count} photos » et l'état : « Vérifié par {verified_by_name} » (vert) ou « À traiter » (accent), une `Balise` « Masqué » (teinte `sommeil`) si masqué ; `Pages` ; `<Outlet />`.
  - `components/TiroirLieu.tsx` : `Tiroir titre={fiche.title} retour="/communaute/lieux"` ; `null` → « Lieu introuvable. » + « Retour à la liste » ; sinon : les photos en rangée (images `thumb ?? url`, 96 px, `--radius-petit`, cliquables vers `url` dans un nouvel onglet) ; « Ajouté par {author_name} ({author_places_count} lieux) · {dateCourte(created_at)} · {visit_count} visites · {discovered_count} découvertes » ; **Le lieu** : champs Nom, Récit (`textarea`), case « Lieu sensible », bouton « Enregistrer le texte » (→ `modifierLieu`) ; **Ses natures** : des cases à cocher pour chaque nature, 1 à 3, l'ordre de coche fait la principale (« ★ » devant la première), bouton « Enregistrer les natures » désactivé hors de 1 à 3 ; **Décision** : « Vérifier le lieu » / « Retirer la vérification » (→ `verifierLieu`), « Masquer le lieu » / « Démasquer » (→ `masquerLieu`), et un lien « Voir dans l’appli » vers `https://app.runesdechene.com/carte/lieu/{id}` (`target="_blank" rel="noreferrer"`) ; chaque erreur s'affiche sous son bloc.
  - `router.tsx` : route `communaute/lieux` + enfant `:id`, ajouter à `ECRANS_FAITS`.

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/516_hub_lieux.sql apps/hub-v2/src
git commit -m "feat(hub-v2): les lieux à modérer — la liste et la fiche de modération"
```

---

### Task 7: Les signalements — la file à deux volets

**Files:**
- Create: `src/features/communaute/api/signalements.ts`, `hooks/useSignalements.ts`, `lib/raisons.ts`, `components/Signalements.tsx`, `components/Signalements.test.tsx`
- Modify: `src/app/router.tsx`, `src/features/communaute/components/Communaute.module.css`

**Interfaces:**
- Consumes (existants) : `mod_signalements()` → tableau `[{ id, raison, precision, quand, lieu: { id, nom, masque }, qui: { id, nom } }]`, non traités, du plus récent au plus ancien, refus en exception (`42501`) hors équipe ; `mod_traiter_signalement(p_id bigint)` → `{ ok }` ; `masquerLieu` et `lireLieu` (Task 6).
- Produces: `type Signalement`, `lireSignalements()`, `traiterSignalement(id)`, `RAISONS: Record<string, string>`.

- [ ] **Step 1: Test (il échoue)** — `src/features/communaute/components/Signalements.test.tsx` :

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { Signalements } from './Signalements'

const sig = vi.hoisted(() => ({ lireSignalements: vi.fn(), traiterSignalement: vi.fn() }))
const lieux = vi.hoisted(() => ({ lireLieu: vi.fn(), masquerLieu: vi.fn() }))
vi.mock('../api/signalements', () => sig)
vi.mock('../api/lieux', async (orig) => ({ ...(await orig<typeof import('../api/lieux')>()), ...lieux }))

const s1 = { id: 41, raison: 'prive_ou_dangereux', precision: 'Propriété privée, chien.', quand: '2026-10-14T09:40:00Z', lieu: { id: 'p9', nom: 'Source de la Fée', masque: false }, qui: { id: 'u5', nom: 'Brune' } }

function monter() {
  const client = new QueryClient()
  const router = createMemoryRouter([{ path: '/communaute/signalements', Component: Signalements }], { initialEntries: ['/communaute/signalements'] })
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>)
  return client
}

test('la file, le premier choisi, sa raison lisible', async () => {
  sig.lireSignalements.mockResolvedValue([s1])
  lieux.lireLieu.mockResolvedValue({ id: 'p9', title: 'Source de la Fée', images: [], masked: false })
  monter()
  expect(await screen.findAllByText('Source de la Fée')).not.toHaveLength(0)
  expect(screen.getAllByText('Lieu privé ou dangereux')).not.toHaveLength(0)
  expect(screen.getByText('« Propriété privée, chien. »')).toBeInTheDocument()
})

test('« Traité » retire le signalement et fait baisser la pastille', async () => {
  sig.lireSignalements.mockResolvedValue([s1])
  sig.traiterSignalement.mockResolvedValue(undefined)
  lieux.lireLieu.mockResolvedValue({ id: 'p9', title: 'Source de la Fée', images: [], masked: false })
  const client = monter()
  const invalider = vi.spyOn(client, 'invalidateQueries')
  await userEvent.click(await screen.findByRole('button', { name: 'Traité' }))
  expect(sig.traiterSignalement).toHaveBeenCalledWith(41)
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-signalements'] })
  expect(invalider).toHaveBeenCalledWith({ queryKey: ['hub-ouverture'] })
})

test('file vide : on le dit', async () => {
  sig.lireSignalements.mockResolvedValue([])
  monter()
  expect(await screen.findByText('Aucun signalement en attente.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Code**
  - `lib/raisons.ts` : `export const RAISONS: Record<string, string> = { n_existe_pas: 'Le lieu n’existe pas', prive_ou_dangereux: 'Lieu privé ou dangereux', doublon: 'Doublon', contenu: 'Contenu inapproprié', autre: 'Autre' }` (repris de l'ancien Hub, `moderation/Signalements.tsx`).
  - `api/signalements.ts` : `lireSignalements()` → `rpc('mod_signalements')` (`throw` en erreur) ; `traiterSignalement(id: number)` → `rpc('mod_traiter_signalement', { p_id: id })`.
  - `hooks/useSignalements.ts` : `useQuery(['hub-signalements'])` et `useTraitement()` qui expose `traiter` (→ `traiterSignalement`) et `masquer` (→ `masquerLieu(id, true)`) ; en succès, invalider `['hub-signalements']`, `['hub-ouverture']`, `['hub-lieux']`.
  - `components/Signalements.tsx` — la file à deux volets du modèle 596:1319 : `EnTeteDePage surtitre="Communauté" titre="Les signalements" phrase="{n} signalements attendent une décision."` ; la sélection est dans l'adresse (`?s=41`, le premier par défaut) ; à gauche (380 px sur PC, pleine largeur au téléphone, au-dessus) un `Bloc` d'une ligne-bouton par signalement : le nom du lieu, la raison lisible, « par {qui.nom} · {depuis(quand)} », la ligne choisie sur fond `--color-pastille` ; à droite un `Bloc` : le nom du lieu en Bebas, une `Balise` de la raison (teinte `moderation`), la précision entre guillemets « … » si présente, les photos du lieu (`lireLieu`, comme TiroirLieu), « Signalé par {qui.nom} le {dateCourte(quand)} », un lien « Voir dans l’appli » et un lien « Ouvrir la fiche de modération » vers `/communaute/lieux/{lieu.id}` ; en bas, « Masquer le lieu » (contour, absent si `lieu.masque`) et « Traité » (plein, accent) ; vide → « Aucun signalement en attente. ».
  - `router.tsx` : route `communaute/signalements`, ajouter à `ECRANS_FAITS`.

Run: `pnpm --filter hub-v2 test && pnpm --filter hub-v2 lint && pnpm --filter hub-v2 build` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/hub-v2/src
git commit -m "feat(hub-v2): les signalements, file à deux volets"
```

---

### Task 8: Préparation en ligne

- [ ] **Step 1:** dans `apps/hub-v2` : `pnpm test && pnpm lint && pnpm build` — tout passe.
- [ ] **Step 2:** déployer sur le site de préparation existant (`.claude/rules/deploiement.md` lu) :

```bash
cd apps/hub-v2 && netlify deploy --prod --dir "$PWD/dist" --no-build --site=5d04dcdd-6374-4e8b-a0f4-fcef64a707f3
```

Vérifier `curl` 200 sur `https://rdc-hub-v2.netlify.app/communaute/comptes`, `/communaute/compagnies`, `/communaute/lieux`, `/communaute/signalements`. `hub.runesdechene.com` ne bouge pas.
- [ ] **Step 3:** `docs/tech-backlog.md`, sous « Hub V2 », ajouter : « Associer un Fragment à la main depuis la fiche d'un compte (plan 4) » et « Membres d'une Compagnie : pas de retrait ni de changement de rôle par l'équipe (YAGNI, à demander) ». Commit `docs(hub): le reste du plan 2`.

---

## Self-Review (fait à l'écriture)

- **Couverture** : spec §11 Comptes (chiffres, filtres, menus, tri, recherche, export, colonnes, tiroir : parcours, rôle, compteurs, Fragments, achats, traces) → Tasks 1, 3, 4 (sauf « associer à la main » → plan 4, noté) ; Compagnies → Task 5 ; Lieux à modérer → Task 6 (définition alignée sur la pastille) ; Signalements → Task 7 ; §5 tiroir et URL → Task 2.
- **Noms** : `hub_comptes`, `hub_compte`, `_hub_comptes_base`, `hub_compagnies`, `hub_compagnie`, `hub_modifier_compagnie`, `hub_lieux` ; `balisesDuCompte`, `versCsv`, `couleurValide`, `RAISONS` ; clés de requête `hub-comptes`, `hub-compte`, `hub-compagnies`, `hub-compagnie`, `hub-lieux`, `hub-lieu`, `hub-signalements`, `hub-ouverture`.
- **Review Focus** : 1 → Task 1 (position) ; 2 → Task 3 test ; 3 → Task 4 test ; 4 → Task 5 tests ; 5 → Tasks 6 et 7 tests.
