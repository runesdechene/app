# Annonces — Bouton CTA + liens markdown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre, depuis le Hub, d'ajouter un lien + texte de bouton à une annonce qui produit un gros bouton CTA en fin de post dans l'app, et rendre les liens markdown du corps cliquables/sécurisés.

**Architecture:** Deux colonnes nullables (`cta_url`, `cta_label`) sur `announcements`. La RPC admin `update_announcement` gagne deux params ; les RPCs de lecture renvoyant la ligne entière exposent les colonnes sans changement. Le Hub édite via deux champs dans l'onglet *Corps* ; l'app rend un composant partagé `AnnouncementCta` après le corps. Un hook DOMPurify force `target="_blank"` sur tous les `<a>` du markdown rendu.

**Tech Stack:** Supabase (Postgres, plpgsql), React 18 + TypeScript strict (Vite), Vitest, `marked` + DOMPurify.

**Spec:** `docs/superpowers/specs/2026-06-15-annonces-cta-design.md`

**Référence existante :** mig `supabase/migrations/219_announcements_schema.sql` (schéma + RPCs annonces).

---

### Task 1: Migration SQL — colonnes CTA + RPC `update_announcement`

**Files:**
- Create: `supabase/migrations/220_announcements_cta.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 220_announcements_cta.sql
-- WHY : Bouton CTA en fin d'annonce (spec 2026-06-15). Deux colonnes nullables
-- portées par la table `announcements` (mig 219). Les RPCs de lecture
-- (get_announcement_by_slug, list_announcements_admin) renvoient la ligne
-- entière -> elles exposent automatiquement cta_url/cta_label. Seule
-- update_announcement doit gagner deux params pour les écrire.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS cta_url   text,
  ADD COLUMN IF NOT EXISTS cta_label text;

-- L'ancienne signature 7-args doit disparaître pour éviter une surcharge ambiguë.
DROP FUNCTION IF EXISTS public.update_announcement(uuid,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.update_announcement(
  p_id            uuid,
  p_title         text,
  p_body          text,
  p_cover_image   text,
  p_push_text     text,
  p_insta_caption text,
  p_type          text,
  p_cta_url       text,
  p_cta_label     text
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.announcements;
  v_url text;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  -- Validation légère de l'URL : http(s) uniquement, sinon NULL (pas de
  -- bouton cassé / pas de javascript:).
  v_url := nullif(btrim(coalesce(p_cta_url, '')), '');
  IF v_url IS NOT NULL AND v_url !~* '^https?://' THEN
    v_url := NULL;
  END IF;

  UPDATE public.announcements SET
    title         = coalesce(p_title, title),
    body          = coalesce(p_body, body),
    cover_image   = p_cover_image,
    push_text     = p_push_text,
    insta_caption = p_insta_caption,
    type          = CASE WHEN p_type IN ('produit','app','marque') THEN p_type ELSE type END,
    cta_url       = v_url,
    cta_label     = nullif(btrim(coalesce(p_cta_label, '')), '')
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.update_announcement(uuid,text,text,text,text,text,text,text,text) TO authenticated;
```

- [ ] **Step 2: Appliquer la migration**

Via le MCP Supabase `apply_migration` (name: `220_announcements_cta`, query = contenu du fichier), OU `npx supabase db push` selon le workflow habituel.
Expected: succès, pas d'erreur de signature.

- [ ] **Step 3: Vérifier en SQL**

Run (MCP `execute_sql`) :
```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'announcements' AND column_name IN ('cta_url','cta_label');
```
Expected: 2 lignes (`cta_url`, `cta_label`).

- [ ] **Step 4: Commit**

```bash
git add "supabase/migrations/220_announcements_cta.sql"
git commit -m "feat(db): annonces — colonnes cta_url/cta_label + update_announcement 9-args"
```

Note : le post-commit hook relance `scripts/graphify-sql.py` car le commit touche `supabase/migrations/`.

---

### Task 2: Hub — type `Announcement` + champs CTA dans le Composer

**Files:**
- Modify: `apps/hub/src/types/announcement.ts`
- Modify: `apps/hub/src/components/annonces/ComposerAnnonce.tsx`

- [ ] **Step 1: Étendre le type `Announcement`**

Dans `apps/hub/src/types/announcement.ts`, ajouter dans l'interface `Announcement`, après la ligne `insta_caption: string | null` :

```typescript
  cta_url: string | null
  cta_label: string | null
```

- [ ] **Step 2: Passer les champs à la RPC dans `handleSave`**

Dans `ComposerAnnonce.tsx`, dans `handleSave`, l'objet passé à `supabase.rpc('update_announcement', { ... })` — ajouter après `p_type: ann.type,` :

```typescript
        p_cta_url: ann.cta_url,
        p_cta_label: ann.cta_label,
```

- [ ] **Step 3: Ajouter les deux champs dans l'onglet *Corps***

Dans `ComposerAnnonce.tsx`, dans le bloc `{tab === 'corps' && (...)}`, juste après la `<div className="composer-preview" ... />` (fin du bloc corps), insérer :

```tsx
          <label>Lien du bouton (CTA)
            <input
              type="url"
              placeholder="https://runesdechene.com/products/..."
              value={ann.cta_url ?? ''}
              onChange={(e) => setField('cta_url', e.target.value || null)}
            />
          </label>
          <label>Texte du bouton
            <input
              type="text"
              placeholder="Découvrir"
              value={ann.cta_label ?? ''}
              onChange={(e) => setField('cta_label', e.target.value || null)}
            />
          </label>
          {ann.cta_url && (
            <div className="composer-cta-preview">
              <span className="composer-field-label">Aperçu du bouton</span>
              <span className="composer-cta-btn">{(ann.cta_label || 'Découvrir')} →</span>
            </div>
          )}
```

- [ ] **Step 4: Style de l'aperçu (optionnel mais propre)**

Dans `apps/hub/src/components/annonces/ComposerAnnonce.css`, ajouter en fin de fichier :

```css
.composer-cta-preview { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.composer-cta-btn {
  align-self: flex-start;
  background: var(--color-accent, #8a5a2b);
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  pointer-events: none;
}
```

- [ ] **Step 5: Build hub**

Run: `pnpm --filter hub build`
Expected: build OK, aucune erreur TS (le type `Announcement` couvre les nouveaux champs).

- [ ] **Step 6: Commit**

```bash
git add "apps/hub/src/types/announcement.ts" "apps/hub/src/components/annonces/ComposerAnnonce.tsx" "apps/hub/src/components/annonces/ComposerAnnonce.css"
git commit -m "feat(hub): annonces — champs lien + texte du bouton CTA dans le Composer"
```

---

### Task 3: App — liens markdown ouverts en nouvel onglet (TDD)

**Files:**
- Modify: `apps/explore-web/src/lib/markdown.ts`
- Test: `apps/explore-web/src/lib/markdown.test.ts`

Note : DOMPurify n'est actif qu'en navigateur (en node/test il est en passthrough). Le hook doit donc être robuste à l'absence d'API. On teste ce qui est testable en node : que `renderMarkdown` produit bien un `<a href=...>` pour un lien markdown (rendu `marked`, indépendant de DOMPurify).

- [ ] **Step 1: Écrire le test**

Dans `apps/explore-web/src/lib/markdown.test.ts`, ajouter dans le `describe('renderMarkdown', ...)` :

```typescript
  it('rend un lien markdown en ancre', () => {
    const html = renderMarkdown('Voir [la boutique](https://runesdechene.com)')
    expect(html).toContain('href="https://runesdechene.com"')
    expect(html).toContain('la boutique')
  })
```

- [ ] **Step 2: Lancer le test (doit passer — marked rend déjà les liens)**

Run: `pnpm --filter explore-web exec vitest run src/lib/markdown.test.ts`
Expected: PASS (confirme la base ; le hook target ajouté ensuite ne casse pas le rendu node).

- [ ] **Step 3: Ajouter le hook DOMPurify `target="_blank"`**

Dans `apps/explore-web/src/lib/markdown.ts`, remplacer le haut du fichier (imports + setOptions) par :

```typescript
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

// Liens du corps -> nouvel onglet + rel sécurisé. Enregistré une seule fois.
// No-op hors navigateur (tests node) où addHook n'est pas disponible.
if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}
```

(Le reste du fichier — `renderMarkdown`, `excerpt` — inchangé.)

- [ ] **Step 4: Relancer les tests**

Run: `pnpm --filter explore-web exec vitest run src/lib/markdown.test.ts`
Expected: PASS (tous, y compris l'entrée vide et excerpt).

- [ ] **Step 5: Commit**

```bash
git add "apps/explore-web/src/lib/markdown.ts" "apps/explore-web/src/lib/markdown.test.ts"
git commit -m "feat(app): liens markdown des annonces ouverts en nouvel onglet (rel sûr)"
```

---

### Task 4: App — type `AnnouncementDetail` + composant `AnnouncementCta`

**Files:**
- Modify: `apps/explore-web/src/types/announcement.ts`
- Create: `apps/explore-web/src/components/announcements/AnnouncementCta.tsx`

- [ ] **Step 1: Étendre `AnnouncementDetail`**

Dans `apps/explore-web/src/types/announcement.ts`, dans l'interface `AnnouncementDetail` (qui `extends AnnouncementListItem`), ajouter après `audience: string` :

```typescript
  cta_url: string | null
  cta_label: string | null
```

- [ ] **Step 2: Créer le composant `AnnouncementCta`**

Créer `apps/explore-web/src/components/announcements/AnnouncementCta.tsx` :

```tsx
interface Props {
  url: string | null
  label: string | null
}

/**
 * Gros bouton call-to-action affiché en fin d'annonce (après le corps, avant
 * le bloc social). Rendu uniquement si une URL est définie. Ouvre en nouvel
 * onglet : les liens pointent vers la boutique, on ne sort pas de la PWA.
 */
export function AnnouncementCta({ url, label }: Props) {
  if (!url) return null
  return (
    <a className="article-cta" href={url} target="_blank" rel="noopener noreferrer">
      {(label?.trim() || 'Découvrir')} →
    </a>
  )
}
```

- [ ] **Step 3: Build (vérifie types + composant)**

Run: `pnpm --filter explore-web build`
Expected: build OK (composant pas encore monté, mais compile).

- [ ] **Step 4: Commit**

```bash
git add "apps/explore-web/src/types/announcement.ts" "apps/explore-web/src/components/announcements/AnnouncementCta.tsx"
git commit -m "feat(app): composant AnnouncementCta + cta_url/cta_label sur AnnouncementDetail"
```

---

### Task 5: App — monter le CTA dans ArticlePage + ArticleModal + CSS

**Files:**
- Modify: `apps/explore-web/src/pages/ArticlePage.tsx`
- Modify: `apps/explore-web/src/components/announcements/ArticleModal.tsx`
- Modify: `apps/explore-web/src/pages/ArticlePage.css`

- [ ] **Step 1: Monter le CTA dans `ArticlePage.tsx`**

Ajouter l'import en haut (avec les autres imports de composants) :

```tsx
import { AnnouncementCta } from '../components/announcements/AnnouncementCta'
```

Puis, dans le JSX de retour, entre `<article className="article-body" ... />` et `<AnnouncementSocial ... />`, insérer :

```tsx
      <AnnouncementCta url={item.cta_url} label={item.cta_label} />
```

- [ ] **Step 2: Monter le CTA dans `ArticleModal.tsx`**

Ajouter l'import (avec les autres imports relatifs) :

```tsx
import { AnnouncementCta } from './AnnouncementCta'
```

Puis, dans le bloc `{item && (...)}`, entre `<article className="article-body" ... />` et `<AnnouncementSocial ... />`, insérer :

```tsx
            <AnnouncementCta url={item.cta_url} label={item.cta_label} />
```

- [ ] **Step 3: Ajouter le style `.article-cta` + souligner les liens du corps**

Dans `apps/explore-web/src/pages/ArticlePage.css`, remplacer la ligne existante :

```css
.article-body a { color: var(--color-accent, #8a5a2b); }
```

par :

```css
.article-body a { color: var(--color-accent, #8a5a2b); text-decoration: underline; }
.article-cta {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 24px 0 8px;
  padding: 16px 20px;
  background: var(--color-accent, #8a5a2b);
  color: var(--color-parchment, #fff);
  font-family: var(--font-accent);
  font-size: 17px;
  letter-spacing: .02em;
  text-align: center;
  text-decoration: none;
  border-radius: 12px;
  border: 1px solid var(--color-sepia);
  transition: filter .15s ease;
}
.article-cta:hover { filter: brightness(1.08); }
.article-cta:active { filter: brightness(.95); }
```

- [ ] **Step 4: Build**

Run: `pnpm --filter explore-web build`
Expected: build OK, aucune erreur TS.

- [ ] **Step 5: Vérification manuelle**

1. Hub (`pnpm --filter hub dev`) : ouvrir une annonce, onglet *Corps*, coller une URL `https://...` + un texte, **Enregistrer**. Vérifier l'aperçu du bouton.
2. App (`pnpm --filter explore-web dev`) : ouvrir `/article/<slug>` de cette annonce (publiée) → gros bouton en bas, avant likes/commentaires ; clic → ouvre la boutique en nouvel onglet.
3. Ajouter un lien `[texte](https://...)` dans le corps → cliquable, nouvel onglet.
4. Annonce sans CTA → aucun bouton (pas de bouton vide).

- [ ] **Step 6: Commit**

```bash
git add "apps/explore-web/src/pages/ArticlePage.tsx" "apps/explore-web/src/components/announcements/ArticleModal.tsx" "apps/explore-web/src/pages/ArticlePage.css"
git commit -m "feat(app): bouton CTA en fin d'annonce (ArticlePage + ArticleModal)"
```

---

## Notes de fin

- **Déploiement** (manuel, après validation) :
  - Hub : `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build`
  - App : `cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build`
- **Bump version** : si un `version.ts`/`APP_VERSION` existe dans les apps touchées, bumper le patch avant le commit final.
- **Push par lot** en fin de session (règle Citadelle).
