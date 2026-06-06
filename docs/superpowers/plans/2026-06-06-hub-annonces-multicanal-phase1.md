# Système d'annonces multi-canal — Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le cœur owned de la spec annonces multi-canal : une table `announcements` (source de vérité Supabase), un Composer dans le Hub, un lecteur in-app `/article/:slug` + liste « Nouvelles », un push broadcast, la publication Blog Shopify (API), et un kit Instagram à coller.

**Architecture:** Hub-and-spoke. L'article canonique vit dans Supabase (`announcements`, `body` en Markdown). Le Hub écrit/édite/publie via RPCs admin (`SECURITY DEFINER`). La publication par canal est idempotente et tracée dans `announcements.channels` (jsonb). Le push broadcast réutilise **intégralement** l'infra Push V1 : un fan-out `INSERT … SELECT` dans `notifications` (type `announcement`) déclenche le trigger existant → `send-push` par utilisateur opt-in. Le Blog Shopify passe par une Netlify Function dédiée (Admin API). L'app lit nativement via RPCs publiques.

**Tech Stack:** Postgres/Supabase (migrations SQL numérotées, RPC `SECURITY DEFINER`), Deno Edge Functions (`send-push`), React 18 + Vite + TS strict (explore-web & hub), React Router, Netlify Functions (Shopify Admin API), `marked` (rendu Markdown), `vitest` (tests logique pure côté explore-web).

---

## Décisions de cadrage (prises en autonomie le 6 juin — à valider par Uriel)

Ces points n'étaient pas tranchés dans la spec ; j'ai pris le défaut le plus sûr et shippable. À revoir au retour :

1. **Génération « XO rédige » → manuelle en Phase 1.** Le repo n'a **aucune intégration LLM**. La génération automatique de brouillons multi-canal supposerait de câbler l'API Claude dans une Netlify Function (skill `claude-api` dispo). Phase 1 = Uriel écrit le corps canonique (Markdown) ; les déclinaisons par canal (texte push, légende Insta) sont des champs **éditables pré-remplis** par dérivation simple (titre + extrait). Le bouton « Régénère cet onglet » est reporté en Phase 1.5 (décision API + clé).
2. **Format du corps = Markdown.** Pas d'éditeur WYSIWYG en Phase 1 (aucun n'existe dans le Hub). Textarea Markdown + preview live (`marked`). WYSIWYG (TipTap) = polish Phase 1.5.
3. **Opt-out push broadcast = `push_important_enabled`** (conforme au tableau des canaux de la spec, ligne « Push »). Pas de nouvelle colonne d'opt-out dédiée en v1. Si le volume d'annonces devient gênant → colonne `push_announcements_enabled` en v2.
4. **Blog Shopify : un seul blog.** On lit l'`id` du blog via `app_settings.shopify_blog_id` (configurable), fallback = premier blog retourné par `blogs.json`. Sync à sens unique Hub → Shopify (jamais l'inverse).
5. **Sanitisation HTML : OUI dès Phase 1.** Le corps Markdown est rendu en HTML via `dangerouslySetInnerHTML` côté lecteur in-app (tous les joueurs). Même si l'authoring est admin-only, on sanitise avec **DOMPurify** côté explore-web (défense en profondeur, coût quasi nul). Le Hub (preview admin-only) sanitise aussi par cohérence.

---

## Vérification (pas de TDD strict partout)

- **SQL** : appliqué via `pnpm dlx supabase db push` (discipline B5), vérifié en prod par `SELECT`/`\d` (MCP `execute_sql`).
- **explore-web** : `vitest` existe → tests unitaires pour la logique pure (markdown util, slugify, mapping). UI vérifiée par `pnpm build` (tsc strict + vite) + run manuel.
- **hub** : pas de test runner → vérification = `pnpm --filter hub build` + run manuel.
- **Edge function** : vérifiée par `supabase functions deploy send-push` + log d'un envoi réel.

---

## File Structure (ce qu'on crée / modifie)

**Supabase**
- Create: `supabase/migrations/219_announcements_schema.sql` — table + indexes + RLS + RPCs CRUD/publish + slug.
- Create: `supabase/migrations/220_announcements_broadcast_push.sql` — RPC `broadcast_announcement_push` + (optionnel) clé `app_settings.shopify_blog_id`.
- Modify: `supabase/functions/send-push/categories.ts` — ajout `announcement: 'important'`.
- Modify: `supabase/functions/send-push/payloads.ts` — ajout case `announcement`.

**explore-web**
- Create: `apps/explore-web/src/types/announcement.ts` — types partagés.
- Create: `apps/explore-web/src/lib/markdown.ts` — `renderMarkdown(md): string` (wrap `marked`) + `excerpt(md, n)`.
- Create: `apps/explore-web/src/lib/markdown.test.ts` — tests vitest.
- Create: `apps/explore-web/src/hooks/useAnnouncements.ts` — liste + détail par slug.
- Create: `apps/explore-web/src/pages/ArticlePage.tsx` + `.css` — lecteur `/article/:slug`.
- Create: `apps/explore-web/src/pages/NouvellesPage.tsx` + `.css` — liste `/nouvelles`.
- Modify: `apps/explore-web/src/App.tsx` — routes `/article/:slug` et `/nouvelles`.
- Modify: `apps/explore-web/src/components/navigation/BottomTabbar.tsx` — entrée Nouvelles (ou via menu Plus).
- Modify: `apps/explore-web/src/sw.ts` — `normalizeAppUrl` autorise `/article/` et `/nouvelles`.

**hub**
- Create: `apps/hub/netlify/functions/shopify-article.ts` — create/update article de blog Shopify.
- Create: `apps/hub/src/lib/markdown.ts` — `renderMarkdown` (preview + body_html).
- Create: `apps/hub/src/types/announcement.ts` — types Hub.
- Create: `apps/hub/src/lib/announcementChannels.ts` — dérivations par canal (push text, insta caption) + helpers.
- Create: `apps/hub/src/components/annonces/ComposerAnnonce.tsx` + `.css` — éditeur multi-onglets + publication.
- Create: `apps/hub/src/components/annonces/AnnouncementsList.tsx` — historique (journal de comm).
- Modify: `apps/hub/src/App.tsx` — routes `/annonces` et `/annonces/nouvelle`.
- Modify: `apps/hub/src/components/Sidebar.tsx` — entrée « Annonces ».

---

## Task 1 : Migration 219 — table `announcements` + RLS + RPCs

**Files:**
- Create: `supabase/migrations/219_announcements_schema.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 219_announcements_schema.sql
-- WHY : Système d'annonces multi-canal (spec 2026-06-05). Le Hub devient la SOURCE
-- DE VÉRITÉ : un article vit ici (Supabase), pas chez Shopify. Chaque canal (blog,
-- app, push, email, insta) est une déclinaison dont l'état de diffusion est tracé
-- dans `channels` (jsonb). L'app lit nativement via RPCs publiques ; le Hub écrit
-- via RPCs admin (SECURITY DEFINER). Audience posée dès v1 ('tout-le-monde').
--
--   - type        : produit | app | marque
--   - status      : draft | published
--   - channels    : { blog, app, push, email, insta } -> none|ready|published|sent
--   - slug        : unique, sert d'URL au lecteur in-app (/article/:slug)

CREATE TABLE IF NOT EXISTS public.announcements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  type                text NOT NULL DEFAULT 'marque'
                        CHECK (type IN ('produit','app','marque')),
  title               text NOT NULL,
  cover_image         text,
  body                text NOT NULL DEFAULT '',        -- Markdown canonique
  push_text           text,                            -- déclinaison push (éditable)
  insta_caption       text,                            -- déclinaison Insta (éditable)
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published')),
  audience            text NOT NULL DEFAULT 'tout-le-monde',
  shopify_article_id  text,
  channels            jsonb NOT NULL DEFAULT
                        '{"blog":"none","app":"none","push":"none","email":"none","insta":"none"}'::jsonb,
  published_at        timestamptz,
  created_by          text REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_status_pub_idx
  ON public.announcements (status, published_at DESC);
CREATE INDEX IF NOT EXISTS announcements_slug_idx
  ON public.announcements (slug);

-- updated_at auto
CREATE OR REPLACE FUNCTION public.tg_announcements_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS announcements_touch ON public.announcements;
CREATE TRIGGER announcements_touch
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.tg_announcements_touch();

-- RLS : lecture publique des articles publiés ; écriture jamais directe (RPCs only).
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_public_read_published" ON public.announcements;
CREATE POLICY "announcements_public_read_published"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- (Pas de policy INSERT/UPDATE/DELETE : tout passe par les RPCs SECURITY DEFINER.)

-- ── Helper admin (réutilisé par toutes les RPCs admin) ──────────────────────
CREATE OR REPLACE FUNCTION public._is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id::text = (auth.uid())::text
       AND users.role::text = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public._is_admin() TO authenticated;

-- ── slug : génère un slug unique à partir d'un titre ────────────────────────
CREATE OR REPLACE FUNCTION public._announcement_slugify(p_title text)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_base text;
BEGIN
  v_base := lower(unaccent_fallback(p_title));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'annonce'; END IF;
  RETURN left(v_base, 60);
END; $$;

-- unaccent peut ne pas être dispo : fallback maison sur les accents FR courants.
CREATE OR REPLACE FUNCTION public.unaccent_fallback(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(
    p,
    'àâäáãçèéêëìíîïñòóôöõùúûüýÿœæÀÂÄÁÃÇÈÉÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝŒÆ',
    'aaaaaceeeeiiiinooooouuuuyyoeaeAAAAACEEEEIIIINOOOOOUUUUYOEAE'
  );
$$;

-- ── RPC admin : créer une annonce (draft) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_announcement(
  p_type  text,
  p_title text
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slug text;
  v_n    int := 0;
  v_row  public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF coalesce(p_title,'') = '' THEN RAISE EXCEPTION 'title_required'; END IF;

  v_slug := public._announcement_slugify(p_title);
  -- unicité : suffixe -2, -3… si collision
  WHILE EXISTS (SELECT 1 FROM public.announcements WHERE slug = v_slug
                  || CASE WHEN v_n = 0 THEN '' ELSE '-' || v_n END) LOOP
    v_n := v_n + 1;
  END LOOP;
  IF v_n > 0 THEN v_slug := v_slug || '-' || v_n; END IF;

  INSERT INTO public.announcements (slug, type, title, created_by)
  VALUES (v_slug,
          CASE WHEN p_type IN ('produit','app','marque') THEN p_type ELSE 'marque' END,
          p_title,
          (auth.uid())::text)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_announcement(text, text) TO authenticated;

-- ── RPC admin : mettre à jour le contenu (brouillon) ────────────────────────
CREATE OR REPLACE FUNCTION public.update_announcement(
  p_id            uuid,
  p_title         text,
  p_body          text,
  p_cover_image   text,
  p_push_text     text,
  p_insta_caption text,
  p_type          text
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE public.announcements SET
    title         = coalesce(p_title, title),
    body          = coalesce(p_body, body),
    cover_image   = p_cover_image,
    push_text     = p_push_text,
    insta_caption = p_insta_caption,
    type          = CASE WHEN p_type IN ('produit','app','marque') THEN p_type ELSE type END
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.update_announcement(uuid,text,text,text,text,text,text) TO authenticated;

-- ── RPC admin : publier (status=published, app=published) ───────────────────
-- Idempotent. Pose published_at une seule fois. Marque le canal app comme publié
-- (l'article devient lisible in-app dès qu'il est published via la RLS).
CREATE OR REPLACE FUNCTION public.publish_announcement(p_id uuid)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE public.announcements SET
    status       = 'published',
    published_at = coalesce(published_at, now()),
    channels     = channels || '{"app":"published"}'::jsonb
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.publish_announcement(uuid) TO authenticated;

-- ── RPC admin : marquer l'état d'un canal (blog/push/email/insta) ───────────
CREATE OR REPLACE FUNCTION public.set_announcement_channel(
  p_id      uuid,
  p_channel text,           -- 'blog'|'app'|'push'|'email'|'insta'
  p_state   text,           -- 'none'|'ready'|'published'|'sent'
  p_shopify_article_id text DEFAULT NULL
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF p_channel NOT IN ('blog','app','push','email','insta') THEN
    RAISE EXCEPTION 'bad_channel';
  END IF;
  IF p_state NOT IN ('none','ready','published','sent') THEN
    RAISE EXCEPTION 'bad_state';
  END IF;
  UPDATE public.announcements SET
    channels = channels || jsonb_build_object(p_channel, p_state),
    shopify_article_id = coalesce(p_shopify_article_id, shopify_article_id)
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_announcement_channel(uuid,text,text,text) TO authenticated;

-- ── RPC admin : liste complète (journal de comm, tous statuts) ──────────────
CREATE OR REPLACE FUNCTION public.list_announcements_admin()
RETURNS SETOF public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  RETURN QUERY SELECT * FROM public.announcements ORDER BY created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.list_announcements_admin() TO authenticated;

-- ── RPC publique : liste « Nouvelles » (publiées) ──────────────────────────
CREATE OR REPLACE FUNCTION public.list_published_announcements(p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid, slug text, type text, title text, cover_image text,
  published_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, slug, type, title, cover_image, published_at
    FROM public.announcements
   WHERE status = 'published'
   ORDER BY published_at DESC
   LIMIT greatest(1, least(coalesce(p_limit,30), 100));
$$;
GRANT EXECUTE ON FUNCTION public.list_published_announcements(int) TO anon, authenticated;

-- ── RPC publique : article par slug ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_announcement_by_slug(p_slug text)
RETURNS public.announcements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.announcements
   WHERE slug = p_slug AND status = 'published'
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_by_slug(text) TO anon, authenticated;
```

- [ ] **Step 2 : Appliquer la migration**

```bash
pnpm dlx supabase db push
```
Expected : `Applying migration 219_announcements_schema.sql...` sans erreur.

- [ ] **Step 3 : Vérifier en prod (MCP execute_sql)**

```sql
-- table présente, 0 ligne
SELECT count(*) FROM public.announcements;
-- RPCs présentes
SELECT proname FROM pg_proc WHERE proname IN
 ('create_announcement','update_announcement','publish_announcement',
  'set_announcement_channel','list_announcements_admin',
  'list_published_announcements','get_announcement_by_slug');
```
Expected : count = 0 ; 7 fonctions listées.

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/219_announcements_schema.sql
git commit -m "feat(annonces): table announcements + RPCs CRUD/publish (mig 219)"
```

---

## Task 2 : Migration 220 — push broadcast (fan-out)

**Files:**
- Create: `supabase/migrations/220_announcements_broadcast_push.sql`

**Approche :** réutilise l'infra Push V1 sans la modifier. La RPC insère une notification
`type='announcement'` par utilisateur opt-in (`push_important_enabled` + `is_active`).
Chaque INSERT déclenche le trigger `push_on_notification` existant → `send-push` par user.
Le trigger email (`email_on_notification`) ignore ce type (il ne traite que
`contribution_approved`) → pas d'email parasite. Même pattern éprouvé que le cron
`daily_enigma_lunch_push`.

- [ ] **Step 1 : Écrire la migration**

```sql
-- 220_announcements_broadcast_push.sql
-- WHY : Canal Push de la spec annonces. broadcast_announcement_push() fait un fan-out
-- (1 notification par user opt-in) ; le trigger push existant (mig 142) prend le relais
-- par utilisateur. On réutilise push_important_enabled comme opt-out (décision Phase 1).
-- Le payload pointe le deeplink /article/:slug (lecteur in-app).
--
--   - admin only · annonce doit être 'published' · idempotence soft via channels.push
--   - clé app_settings.shopify_blog_id (configurable) posée ici pour le canal Blog.

INSERT INTO public.app_settings (key, value)
VALUES ('shopify_blog_id', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.broadcast_announcement_push(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ann   public.announcements;
  v_count int;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;

  SELECT * INTO v_ann FROM public.announcements WHERE id = p_id;
  IF v_ann.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_ann.status <> 'published' THEN RAISE EXCEPTION 'not_published'; END IF;

  -- Fan-out : 1 notification par user opt-in actif. Le trigger push fait le reste.
  INSERT INTO public.notifications (recipient_id, type, data)
  SELECT u.id,
         'announcement',
         jsonb_build_object(
           'announcement_id', v_ann.id,
           'slug',            v_ann.slug,
           'title',           v_ann.title,
           'push_text',       v_ann.push_text
         )
    FROM public.users u
   WHERE u.push_important_enabled = true
     AND u.is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Trace le canal push comme envoyé.
  UPDATE public.announcements
     SET channels = channels || '{"push":"sent"}'::jsonb
   WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'recipients', v_count);
END; $$;
GRANT EXECUTE ON FUNCTION public.broadcast_announcement_push(uuid) TO authenticated;
```

- [ ] **Step 2 : Appliquer + vérifier**

```bash
pnpm dlx supabase db push
```
Puis (MCP) :
```sql
SELECT proname FROM pg_proc WHERE proname = 'broadcast_announcement_push';
SELECT key FROM public.app_settings WHERE key = 'shopify_blog_id';
```
Expected : 1 fonction, 1 clé.

> ⚠️ NE PAS exécuter `broadcast_announcement_push` sur une vraie annonce tant que le
> canal n'est pas validé par Uriel (envoie un vrai push à tous les opt-in).

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/220_announcements_broadcast_push.sql
git commit -m "feat(annonces): broadcast_announcement_push + clé shopify_blog_id (mig 220)"
```

---

## Task 3 : Edge function `send-push` — type `announcement`

**Files:**
- Modify: `supabase/functions/send-push/categories.ts`
- Modify: `supabase/functions/send-push/payloads.ts`

- [ ] **Step 1 : categories.ts — ajouter le type**

Dans `CATEGORY_BY_TYPE`, après `like_contribution: 'important',` :
```ts
  // Annonces multi-canal (broadcast)
  announcement:             'important',
```

- [ ] **Step 2 : payloads.ts — ajouter le case**

Avant `default:` dans le `switch (type)` :
```ts
    case 'announcement': {
      const slug      = fr(data.slug)
      const title     = fr(data.title, 'Une nouvelle de Runes de Chêne')
      const pushText  = fr(data.push_text, '').slice(0, 120)
      return {
        title,
        body:  pushText || 'Touche pour lire la nouvelle.',
        url:   slug ? `/article/${slug}` : '/nouvelles',
      }
    }
```

- [ ] **Step 3 : Déployer la fonction**

```bash
pnpm dlx supabase functions deploy send-push
```
Expected : `Deployed Function send-push`.

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/send-push/categories.ts supabase/functions/send-push/payloads.ts
git commit -m "feat(push): supporte le type announcement (broadcast deeplink /article)"
```

---

## Task 4 : explore-web — lecteur in-app + liste Nouvelles

**Files:**
- Create: `apps/explore-web/src/types/announcement.ts`
- Create: `apps/explore-web/src/lib/markdown.ts`
- Create: `apps/explore-web/src/lib/markdown.test.ts`
- Create: `apps/explore-web/src/hooks/useAnnouncements.ts`
- Create: `apps/explore-web/src/pages/ArticlePage.tsx` + `ArticlePage.css`
- Create: `apps/explore-web/src/pages/NouvellesPage.tsx` + `NouvellesPage.css`
- Modify: `apps/explore-web/src/App.tsx`
- Modify: `apps/explore-web/src/components/navigation/BottomTabbar.tsx`
- Modify: `apps/explore-web/src/sw.ts`

- [ ] **Step 1 : Ajouter les dépendances `marked` + `dompurify`**

```bash
pnpm --filter explore-web add marked dompurify
pnpm --filter explore-web add -D @types/dompurify
```

- [ ] **Step 2 : types/announcement.ts**

```ts
export type AnnouncementType = 'produit' | 'app' | 'marque'

export interface AnnouncementListItem {
  id: string
  slug: string
  type: AnnouncementType
  title: string
  cover_image: string | null
  published_at: string | null
}

export interface AnnouncementDetail extends AnnouncementListItem {
  body: string            // Markdown
  audience: string
}
```

- [ ] **Step 3 : lib/markdown.ts**

```ts
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

/** Rendu Markdown → HTML sanitisé (DOMPurify — défense en profondeur, cf. décision 5). */
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md ?? '', { async: false }) as string
  return DOMPurify.sanitize(raw)
}

/** Extrait texte brut (pour cartes liste / méta), longueur bornée. */
export function excerpt(md: string, max = 140): string {
  const plain = (md ?? '')
    .replace(/[#>*_`~\-]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain
}
```

- [ ] **Step 4 : lib/markdown.test.ts (vitest)**

```ts
import { describe, it, expect } from 'vitest'
import { renderMarkdown, excerpt } from './markdown'

describe('renderMarkdown', () => {
  it('rend le gras et les titres', () => {
    const html = renderMarkdown('# Titre\n\nUn **mot** fort.')
    expect(html).toContain('<h1>Titre</h1>')
    expect(html).toContain('<strong>mot</strong>')
  })
  it('gère une entrée vide', () => {
    expect(renderMarkdown('')).toBe('')
  })
})

describe('excerpt', () => {
  it('retire la syntaxe markdown et borne la longueur', () => {
    expect(excerpt('# Bonjour **monde**')).toBe('Bonjour monde')
    expect(excerpt('a'.repeat(200)).endsWith('…')).toBe(true)
  })
  it('garde le texte des liens', () => {
    expect(excerpt('Voir [la boutique](https://x.com)')).toContain('la boutique')
  })
})
```

- [ ] **Step 5 : Lancer les tests**

```bash
pnpm --filter explore-web test -- markdown
```
Expected : 4 tests PASS.

- [ ] **Step 6 : hooks/useAnnouncements.ts**

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AnnouncementDetail, AnnouncementListItem } from '../types/announcement'

export function useAnnouncementsList(limit = 30) {
  const [items, setItems] = useState<AnnouncementListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    const { data, error: e } = await supabase.rpc('list_published_announcements', { p_limit: limit })
    setLoading(false)
    if (e) { setError(e.message); return }
    setItems((data ?? []) as AnnouncementListItem[])
  }, [limit])

  useEffect(() => { refresh() }, [refresh])
  return { items, loading, error, refresh }
}

export function useAnnouncement(slug: string | undefined) {
  const [item, setItem] = useState<AnnouncementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!slug) { setLoading(false); return }
    setLoading(true); setError(null)
    supabase.rpc('get_announcement_by_slug', { p_slug: slug }).then(({ data, error: e }) => {
      if (cancelled) return
      setLoading(false)
      if (e) { setError(e.message); return }
      setItem((data ?? null) as AnnouncementDetail | null)
    })
    return () => { cancelled = true }
  }, [slug])

  return { item, loading, error }
}
```

- [ ] **Step 7 : pages/ArticlePage.tsx**

```tsx
import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAnnouncement } from '../hooks/useAnnouncements'
import { renderMarkdown } from '../lib/markdown'
import { formatFrenchLongDate } from '../lib/dateFormat'
import './ArticlePage.css'

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const { item, loading, error } = useAnnouncement(slug)

  useEffect(() => {
    document.title = item ? `Runes de Chêne — ${item.title}` : 'Runes de Chêne — Nouvelle'
  }, [item])

  const html = useMemo(() => (item ? renderMarkdown(item.body) : ''), [item])

  if (loading) return <main className="article-page"><p className="article-loading">Chargement…</p></main>
  if (error || !item) return (
    <main className="article-page">
      <p className="article-empty">Cette nouvelle n'existe pas ou n'est plus disponible.</p>
      <Link to="/nouvelles" className="article-back">← Toutes les nouvelles</Link>
    </main>
  )

  return (
    <main className="article-page">
      <Link to="/nouvelles" className="article-back">← Nouvelles</Link>
      {item.cover_image && (
        <img className="article-cover" src={item.cover_image} alt="" loading="lazy" />
      )}
      <h1 className="article-title">{item.title}</h1>
      {item.published_at && (
        <p className="article-date">{formatFrenchLongDate(new Date(item.published_at))}</p>
      )}
      <article className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  )
}
```

> Note : `formatFrenchLongDate` existe dans `lib/dateFormat.ts` (cf. helpers extraits).
> Vérifier sa signature au moment d'implémenter ; adapter l'appel si elle prend une string.

- [ ] **Step 8 : pages/ArticlePage.css** (convention parchemin, mobile-first)

```css
.article-page {
  flex: 1; min-height: 0; overflow-y: auto;
  background: var(--color-parchment);
  padding: 16px 16px calc(80px + env(safe-area-inset-bottom, 0px));
  max-width: 720px; margin: 0 auto;
}
.article-back {
  display: inline-block; margin: 4px 0 12px;
  font-family: var(--font-accent); font-size: 13px; letter-spacing: .04em;
  color: var(--color-ink); text-decoration: none; opacity: .8;
}
.article-cover {
  width: 100%; border-radius: 14px; border: 1px solid var(--color-sepia);
  margin-bottom: 16px; object-fit: cover;
}
.article-title {
  font-family: var(--font-accent); font-size: 26px; line-height: 1.15;
  color: var(--color-ink); margin: 0 0 6px;
}
.article-date { font-size: 13px; opacity: .65; margin: 0 0 20px; }
.article-body { font-size: 16px; line-height: 1.65; color: var(--color-ink); }
.article-body h2 { font-family: var(--font-accent); font-size: 20px; margin: 24px 0 8px; }
.article-body img { max-width: 100%; border-radius: 10px; }
.article-body a { color: var(--color-accent, #8a5a2b); }
.article-loading, .article-empty { padding: 40px 0; text-align: center; opacity: .7; }
```

- [ ] **Step 9 : pages/NouvellesPage.tsx**

```tsx
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAnnouncementsList } from '../hooks/useAnnouncements'
import { formatFrenchLongDate } from '../lib/dateFormat'
import './NouvellesPage.css'

const TYPE_LABEL: Record<string, string> = {
  produit: 'Boutique', app: 'L\'app', marque: 'La marque',
}

export default function NouvellesPage() {
  const { items, loading, error } = useAnnouncementsList(30)
  useEffect(() => { document.title = 'Runes de Chêne — Nouvelles' }, [])

  return (
    <main className="nouvelles-page">
      <h1 className="nouvelles-title">Nouvelles</h1>
      {loading && <p className="nouvelles-state">Chargement…</p>}
      {error && <p className="nouvelles-state">Impossible de charger les nouvelles.</p>}
      {!loading && !error && items.length === 0 && (
        <p className="nouvelles-state">Rien à signaler pour l'instant.</p>
      )}
      <ul className="nouvelles-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link to={`/article/${a.slug}`} className="nouvelles-card">
              {a.cover_image && <img className="nouvelles-thumb" src={a.cover_image} alt="" loading="lazy" />}
              <div className="nouvelles-card-text">
                <span className="nouvelles-tag">{TYPE_LABEL[a.type] ?? a.type}</span>
                <h2 className="nouvelles-card-title">{a.title}</h2>
                {a.published_at && (
                  <span className="nouvelles-card-date">{formatFrenchLongDate(new Date(a.published_at))}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 10 : pages/NouvellesPage.css**

```css
.nouvelles-page {
  flex: 1; min-height: 0; overflow-y: auto;
  background: var(--color-parchment);
  padding: 16px 16px calc(80px + env(safe-area-inset-bottom, 0px));
}
.nouvelles-title {
  font-family: var(--font-accent); font-size: 22px; text-transform: uppercase;
  letter-spacing: .06em; color: var(--color-ink); margin: 4px 0 16px;
}
.nouvelles-state { opacity: .7; padding: 24px 0; text-align: center; }
.nouvelles-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.nouvelles-card {
  display: flex; gap: 12px; align-items: center; text-decoration: none;
  background: var(--color-parchment-dark); border: 1px solid var(--color-sepia);
  border-radius: 14px; padding: 10px 12px; box-shadow: 0 4px 14px rgba(74,55,40,.12);
}
.nouvelles-thumb { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
.nouvelles-card-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.nouvelles-tag {
  font-family: var(--font-accent); font-size: 11px; letter-spacing: .06em;
  text-transform: uppercase; opacity: .65;
}
.nouvelles-card-title { font-size: 16px; color: var(--color-ink); margin: 0; }
.nouvelles-card-date { font-size: 12px; opacity: .6; }
```

- [ ] **Step 11 : App.tsx — routes**

Ajouter les imports lazy en tête (avec les autres) :
```tsx
const NouvellesPage = lazy(() => import('./pages/NouvellesPage'))
const ArticlePage = lazy(() => import('./pages/ArticlePage'))
```
Et, à l'intérieur du bloc `<MobileOnly><MobileLayout /></MobileOnly>` (au même niveau que `/accueil`) :
```tsx
              <Route path="/nouvelles" element={<NouvellesPage />} />
              <Route path="/article/:slug" element={<ArticlePage />} />
```

> Vérifier la structure exacte d'`App.tsx` à l'implémentation (le rapport d'exploration
> montre `/accueil`, `/chat`, `/activite` sous MobileLayout). Placer les 2 routes au même endroit.

- [ ] **Step 12 : BottomTabbar — entrée Nouvelles**

La tabbar a déjà 4 cellules + bouton « + ». Pour ne pas surcharger, ajouter « Nouvelles »
dans le **menu Plus** (`BottomTabbarPlusMenu.tsx`) plutôt que la tabbar principale.
Vérifier le composant et y ajouter un lien `to="/nouvelles"` (label « Nouvelles », icône 📰).
Si le menu Plus ne contient que des actions de création, alors ajouter à la place une
5ᵉ cellule discrète dans `BottomTabbar.tsx` :
```tsx
        <TabbarCell to="/nouvelles" icon="📰" label="Nouvelles" />
```

> Décision d'emplacement laissée à l'implémenteur selon ce que contient `BottomTabbarPlusMenu`.
> Défaut recommandé : menu Plus (la tabbar à 5 items + bouton central devient chargée sur petit écran).

- [ ] **Step 13 : sw.ts — autoriser le deeplink article**

Remplacer `normalizeAppUrl` :
```ts
function normalizeAppUrl(raw: string): string {
  if (
    raw.startsWith('/carte') ||
    raw.startsWith('/accueil') ||
    raw.startsWith('/article/') ||
    raw.startsWith('/nouvelles')
  ) return raw
  const queryIdx = raw.indexOf('?')
  const query = queryIdx >= 0 ? raw.slice(queryIdx) : ''
  return '/carte' + query
}
```

- [ ] **Step 14 : Build + tests**

```bash
pnpm --filter explore-web test run
pnpm --filter explore-web build
```
Expected : tests PASS, build `tsc && vite build` sans erreur TS.

- [ ] **Step 15 : Commit**

```bash
git add apps/explore-web
git commit -m "feat(annonces): lecteur in-app /article/:slug + liste /nouvelles + deeplink push"
```

---

## Task 5 : hub — Netlify Function `shopify-article`

**Files:**
- Create: `apps/hub/netlify/functions/shopify-article.ts`

**Rôle :** create/update d'un article de blog Shopify via Admin API. Mirroir public,
SEO. Reçoit `{ announcement, shopify_article_id? }`, convertit le Markdown en HTML,
crée ou met à jour l'article, renvoie `{ article_id }`. Mirroir des patterns existants
(`requireAdmin`, `json`, `SHOPIFY_ACCESS_TOKEN`, `2026-01` API version).

- [ ] **Step 1 : Ajouter `marked` au hub**

```bash
pnpm --filter hub add marked
```

- [ ] **Step 2 : netlify/functions/shopify-article.ts**

```ts
// Netlify Function: publie/maj un article de blog Shopify (miroir public d'une annonce).
// Sync à sens unique Hub -> Shopify. Auth admin requise.
import { marked } from 'marked'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
const SHOP = process.env.SHOPIFY_SHOP || 'runes-de-chene.myshopify.com'
const API = '2026-01'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

async function requireAdmin(request: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!bearer) return { error: 'Missing Authorization header', status: 401 }
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${bearer}` },
  })
  if (!userResp.ok) return { error: 'Invalid session', status: 401 }
  const user = await userResp.json() as { id?: string }
  if (!user?.id) return { error: 'Invalid session', status: 401 }
  const roleResp = await fetch(`${SUPABASE_URL}/rest/v1/users?select=role&id=eq.${user.id}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const rows = await roleResp.json() as Array<{ role?: string }>
  if (!rows[0] || rows[0].role !== 'admin') return { error: 'Forbidden — admin only', status: 403 }
  return { userId: user.id }
}

async function shopify(endpoint: string, init: RequestInit) {
  return fetch(`https://${SHOP}/admin/api/${API}/${endpoint}`, {
    ...init,
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN!,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

interface AnnouncementInput {
  title: string
  body: string            // Markdown
  cover_image?: string | null
  type?: string
}

async function resolveBlogId(): Promise<string | null> {
  // 1) app_settings.shopify_blog_id ; 2) premier blog Shopify
  const sresp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=value&key=eq.shopify_blog_id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const srows = await sresp.json() as Array<{ value?: string }>
  const configured = srows[0]?.value
  if (configured) return configured
  const bresp = await shopify('blogs.json', { method: 'GET' })
  if (!bresp.ok) return null
  const blogs = await bresp.json() as { blogs?: Array<{ id: number }> }
  return blogs.blogs?.[0]?.id ? String(blogs.blogs[0].id) : null
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!SHOPIFY_TOKEN) return json({ error: 'SHOPIFY_ACCESS_TOKEN not configured' }, 500)

  const auth = await requireAdmin(request)
  if ('error' in auth) return json({ error: auth.error }, auth.status)

  let payload: { announcement: AnnouncementInput; shopify_article_id?: string | null }
  try { payload = await request.json() } catch { return json({ error: 'bad_json' }, 400) }
  const { announcement, shopify_article_id } = payload
  if (!announcement?.title) return json({ error: 'title_required' }, 400)

  const blogId = await resolveBlogId()
  if (!blogId) return json({ error: 'no_shopify_blog' }, 500)

  const body_html = marked.parse(announcement.body ?? '', { async: false }) as string
  const articleBody = {
    article: {
      title: announcement.title,
      body_html,
      ...(announcement.cover_image ? { image: { src: announcement.cover_image } } : {}),
      tags: announcement.type ? `annonce,${announcement.type}` : 'annonce',
    },
  }

  try {
    let resp: Response
    if (shopify_article_id) {
      resp = await shopify(`blogs/${blogId}/articles/${shopify_article_id}.json`, {
        method: 'PUT', body: JSON.stringify(articleBody),
      })
    } else {
      resp = await shopify(`blogs/${blogId}/articles.json`, {
        method: 'POST', body: JSON.stringify(articleBody),
      })
    }
    const data = await resp.json() as { article?: { id?: number } }
    if (!resp.ok || !data.article?.id) {
      return json({ error: 'shopify_error', detail: data }, 502)
    }
    return json({ article_id: String(data.article.id) })
  } catch (e) {
    return json({ error: `shopify_request_failed: ${e}` }, 502)
  }
}

export const config = { path: '/.netlify/functions/shopify-article' }
```

- [ ] **Step 3 : Build hub (vérifie la compilation de la fonction via le bundle Netlify)**

```bash
pnpm --filter hub build
```
> Note : les Netlify Functions sont bundlées au deploy (esbuild). Le `pnpm build` vite ne
> compile pas `netlify/functions/`. Vérifier la fonction par `netlify deploy` (Step suivant)
> ou un `tsc --noEmit` ciblé. Au minimum : relire le typage (TS strict, pas de `any`).

- [ ] **Step 4 : Commit**

```bash
git add apps/hub/netlify/functions/shopify-article.ts apps/hub/package.json
git commit -m "feat(annonces): netlify function shopify-article (create/update blog article)"
```

> ⚠️ Le déploiement de la fonction + le test réel d'écriture sur le blog Shopify nécessitent
> `SHOPIFY_ACCESS_TOKEN` avec scope `write_content` et le `shopify_blog_id`. À valider avec Uriel
> (vérifier le scope du token actuel — la sync customers/products n'implique pas forcément `write_content`).

---

## Task 6 : hub — Composer d'annonce + Historique

**Files:**
- Create: `apps/hub/src/types/announcement.ts`
- Create: `apps/hub/src/lib/markdown.ts`
- Create: `apps/hub/src/lib/announcementChannels.ts`
- Create: `apps/hub/src/components/annonces/ComposerAnnonce.tsx` + `.css`
- Create: `apps/hub/src/components/annonces/AnnouncementsList.tsx`
- Modify: `apps/hub/src/App.tsx`
- Modify: `apps/hub/src/components/Sidebar.tsx`

- [ ] **Step 1 : types/announcement.ts (hub)**

```ts
export type AnnouncementType = 'produit' | 'app' | 'marque'
export type ChannelState = 'none' | 'ready' | 'published' | 'sent'
export type Channel = 'blog' | 'app' | 'push' | 'email' | 'insta'

export interface Announcement {
  id: string
  slug: string
  type: AnnouncementType
  title: string
  cover_image: string | null
  body: string
  push_text: string | null
  insta_caption: string | null
  status: 'draft' | 'published'
  audience: string
  shopify_article_id: string | null
  channels: Record<Channel, ChannelState>
  published_at: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2 : lib/markdown.ts (hub)** — identique à explore-web (preview)

```ts
import { marked } from 'marked'
marked.setOptions({ breaks: true, gfm: true })
export function renderMarkdown(md: string): string {
  return marked.parse(md ?? '', { async: false }) as string
}
```

- [ ] **Step 3 : lib/announcementChannels.ts — dérivations par canal**

```ts
import type { Announcement } from '../types/announcement'

/** Texte push par défaut : push_text custom, sinon 1re phrase du corps. */
export function defaultPushText(a: Pick<Announcement, 'push_text' | 'body'>): string {
  if (a.push_text && a.push_text.trim()) return a.push_text.trim()
  const firstLine = (a.body ?? '').split('\n').find(l => l.trim().length > 0) ?? ''
  return firstLine.replace(/[#*_`>]/g, '').trim().slice(0, 120)
}

/** Légende Insta par défaut : caption custom, sinon titre + corps tronqué + signature. */
export function defaultInstaCaption(a: Pick<Announcement, 'insta_caption' | 'title' | 'body'>): string {
  if (a.insta_caption && a.insta_caption.trim()) return a.insta_caption
  const plain = (a.body ?? '').replace(/[#*_`>\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)
  return `${a.title}\n\n${plain}\n\n#RunesDeChene #Patrimoine #Histoire`
}

export const CHANNEL_LABELS: Record<string, string> = {
  blog: 'Blog Shopify', app: 'Lecteur app', push: 'Push', email: 'Email', insta: 'Instagram',
}
```

- [ ] **Step 4 : components/annonces/ComposerAnnonce.tsx**

Composant suivant le pattern Hub (supabase RPC, SaveBar, deep-copy dirty state, try/finally).
Onglets : **Corps** (Markdown + preview) · **Push** · **Instagram**. Bandeau de publication
avec cases par canal. Flux :
1. À l'arrivée sans `id` : bouton « Nouvelle annonce » (type + titre) → `create_announcement` → route vers l'éditeur avec l'id.
2. Édition : champs → `update_announcement` au save (SaveBar).
3. Publication : `publish_announcement` (app live) ; puis par canal :
   - Blog → `fetch('/.netlify/functions/shopify-article', {Authorization: Bearer jwt, body:{announcement, shopify_article_id}})` → `set_announcement_channel('blog','published', article_id)`.
   - Push → `broadcast_announcement_push(id)` (confirm() obligatoire — envoi réel).
   - Insta → affiche la légende + bouton « Copier » → `set_announcement_channel('insta','ready')`.

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SaveBar } from '../SaveBar'
import { renderMarkdown } from '../../lib/markdown'
import { defaultPushText, defaultInstaCaption, CHANNEL_LABELS } from '../../lib/announcementChannels'
import type { Announcement, Channel } from '../../types/announcement'
import './ComposerAnnonce.css'

type Tab = 'corps' | 'push' | 'insta'

export function ComposerAnnonce() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ann, setAnn] = useState<Announcement | null>(null)
  const [saved, setSaved] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('corps')
  const [busyChannel, setBusyChannel] = useState<Channel | null>(null)

  const hasChanges = JSON.stringify(ann) !== JSON.stringify(saved)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) { setLoading(false); return }
      setLoading(true)
      try {
        const { data, error: e } = await supabase
          .from('announcements').select('*').eq('id', id).single()
        if (cancelled) return
        if (e) { setError(e.message); return }
        const row = data as Announcement
        setAnn(JSON.parse(JSON.stringify(row)))
        setSaved(JSON.parse(JSON.stringify(row)))
      } finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  function set<K extends keyof Announcement>(field: K, value: Announcement[K]) {
    setAnn(prev => prev ? { ...prev, [field]: value } : prev)
  }

  async function handleSave() {
    if (!ann) return
    setSaving(true); setError(null)
    try {
      const { data, error: e } = await supabase.rpc('update_announcement', {
        p_id: ann.id, p_title: ann.title, p_body: ann.body,
        p_cover_image: ann.cover_image, p_push_text: ann.push_text,
        p_insta_caption: ann.insta_caption, p_type: ann.type,
      })
      if (e) { setError(e.message); return }
      const row = data as Announcement
      setAnn(JSON.parse(JSON.stringify(row)))
      setSaved(JSON.parse(JSON.stringify(row)))
    } finally { setSaving(false) }
  }

  function handleCancel() { setAnn(saved ? JSON.parse(JSON.stringify(saved)) : null); setError(null) }

  async function refetch() {
    if (!id) return
    const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
    if (data) { setAnn(JSON.parse(JSON.stringify(data))); setSaved(JSON.parse(JSON.stringify(data))) }
  }

  async function doPublishApp() {
    if (!ann) return
    setBusyChannel('app'); setError(null)
    try {
      const { error: e } = await supabase.rpc('publish_announcement', { p_id: ann.id })
      if (e) { setError(e.message); return }
      await refetch()
    } finally { setBusyChannel(null) }
  }

  async function doBlog() {
    if (!ann) return
    setBusyChannel('blog'); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      const resp = await fetch('/.netlify/functions/shopify-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          announcement: { title: ann.title, body: ann.body, cover_image: ann.cover_image, type: ann.type },
          shopify_article_id: ann.shopify_article_id,
        }),
      })
      const out = await resp.json()
      if (!resp.ok) { setError(out.error || 'Erreur Shopify'); return }
      await supabase.rpc('set_announcement_channel', {
        p_id: ann.id, p_channel: 'blog', p_state: 'published', p_shopify_article_id: out.article_id,
      })
      await refetch()
    } finally { setBusyChannel(null) }
  }

  async function doPush() {
    if (!ann) return
    if (!window.confirm('Envoyer un push à TOUS les abonnés opt-in ? Action irréversible.')) return
    setBusyChannel('push'); setError(null)
    try {
      const { data, error: e } = await supabase.rpc('broadcast_announcement_push', { p_id: ann.id })
      if (e) { setError(e.message); return }
      window.alert(`Push envoyé à ${(data as { recipients?: number })?.recipients ?? '?'} abonnés.`)
      await refetch()
    } finally { setBusyChannel(null) }
  }

  async function markInstaReady() {
    if (!ann) return
    await supabase.rpc('set_announcement_channel', { p_id: ann.id, p_channel: 'insta', p_state: 'ready' })
    await refetch()
  }

  // ----- création (pas d'id) -----
  if (!id) return <NewAnnouncementForm onCreated={(newId) => navigate(`/annonces/${newId}`)} />

  if (loading) return <div className="loading">Chargement…</div>
  if (!ann) return <div className="loading">Annonce introuvable. {error}</div>

  const instaCaption = defaultInstaCaption(ann)
  const pushPreview = defaultPushText(ann)
  const isPublished = ann.status === 'published'

  return (
    <div className="composer" style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>{ann.title || 'Annonce'}</h1>
        <span className={`composer-status composer-status--${ann.status}`}>{ann.status}</span>
      </div>

      <div className="composer-tabs">
        {(['corps','push','insta'] as Tab[]).map(t => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'corps' ? 'Corps' : t === 'push' ? 'Push' : 'Instagram'}
          </button>
        ))}
      </div>

      {tab === 'corps' && (
        <div className="composer-corps">
          <label>Type
            <select value={ann.type} onChange={e => set('type', e.target.value as Announcement['type'])}>
              <option value="produit">Produit</option>
              <option value="app">App</option>
              <option value="marque">Marque</option>
            </select>
          </label>
          <label>Titre
            <input type="text" value={ann.title} onChange={e => set('title', e.target.value)} />
          </label>
          <label>Image de couverture (URL)
            <input type="text" value={ann.cover_image ?? ''} onChange={e => set('cover_image', e.target.value || null)} />
          </label>
          <label>Corps (Markdown)
            <textarea rows={16} value={ann.body} onChange={e => set('body', e.target.value)} />
          </label>
          <div className="composer-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(ann.body) }} />
        </div>
      )}

      {tab === 'push' && (
        <div className="composer-channel">
          <label>Texte du push (optionnel — défaut : 1re ligne du corps)
            <input type="text" maxLength={120} value={ann.push_text ?? ''} onChange={e => set('push_text', e.target.value || null)} />
          </label>
          <p className="composer-hint">Aperçu : <strong>{ann.title}</strong> — {pushPreview}</p>
        </div>
      )}

      {tab === 'insta' && (
        <div className="composer-channel">
          <label>Légende Instagram (optionnel — défaut généré)
            <textarea rows={6} value={ann.insta_caption ?? ''} onChange={e => set('insta_caption', e.target.value || null)} />
          </label>
          <div className="composer-insta-kit">
            <pre>{instaCaption}</pre>
            <button onClick={() => { navigator.clipboard.writeText(instaCaption); markInstaReady() }}>Copier la légende</button>
          </div>
        </div>
      )}

      <div className="composer-publish">
        <h2>Publication</h2>
        <ChannelRow label={CHANNEL_LABELS.app} state={ann.channels.app}
          action={<button disabled={busyChannel !== null} onClick={doPublishApp}>{isPublished ? 'Publié' : 'Publier dans l\'app'}</button>} />
        <ChannelRow label={CHANNEL_LABELS.blog} state={ann.channels.blog}
          action={<button disabled={!isPublished || busyChannel !== null} onClick={doBlog}>{ann.shopify_article_id ? 'Mettre à jour' : 'Publier'}</button>} />
        <ChannelRow label={CHANNEL_LABELS.push} state={ann.channels.push}
          action={<button disabled={!isPublished || busyChannel !== null} onClick={doPush}>Broadcast</button>} />
        <ChannelRow label={CHANNEL_LABELS.insta} state={ann.channels.insta}
          action={<span className="composer-hint">→ onglet Instagram (copier-coller)</span>} />
        <ChannelRow label={CHANNEL_LABELS.email} state={ann.channels.email}
          action={<span className="composer-hint">Phase 2 (Resend)</span>} />
      </div>

      {error && <p className="composer-error">{error}</p>}
      <SaveBar hasChanges={hasChanges} saving={saving} error={error} onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}

function ChannelRow({ label, state, action }: { label: string; state: string; action: React.ReactNode }) {
  return (
    <div className="channel-row">
      <span className="channel-name">{label}</span>
      <span className={`channel-state channel-state--${state}`}>{state}</span>
      <span className="channel-action">{action}</span>
    </div>
  )
}

function NewAnnouncementForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [type, setType] = useState<Announcement['type']>('produit')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function create() {
    setBusy(true); setErr(null)
    try {
      const { data, error } = await supabase.rpc('create_announcement', { p_type: type, p_title: title })
      if (error) { setErr(error.message); return }
      onCreated((data as Announcement).id)
    } finally { setBusy(false) }
  }
  return (
    <div className="composer-new">
      <h1>Nouvelle annonce</h1>
      <label>Type
        <select value={type} onChange={e => setType(e.target.value as Announcement['type'])}>
          <option value="produit">Produit</option><option value="app">App</option><option value="marque">Marque</option>
        </select>
      </label>
      <label>Titre / matière première
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex. Nouvelle broche Yggdrasil" />
      </label>
      <button disabled={busy || !title.trim()} onClick={create}>Créer le brouillon</button>
      {err && <p className="composer-error">{err}</p>}
    </div>
  )
}
```

- [ ] **Step 5 : components/annonces/ComposerAnnonce.css**

```css
.composer { padding: 16px; max-width: 860px; }
.composer-status { padding: 2px 10px; border-radius: 999px; font-size: 12px; text-transform: uppercase; }
.composer-status--draft { background: #e8dcc2; }
.composer-status--published { background: #c8e0c0; }
.composer-tabs { display: flex; gap: 4px; margin: 12px 0; border-bottom: 1px solid var(--sepia, #c8b08a); }
.composer-tabs button { padding: 8px 14px; border: none; background: none; cursor: pointer; }
.composer-tabs button.active { border-bottom: 2px solid var(--ink, #4a3728); font-weight: 600; }
.composer-corps label, .composer-channel label { display: block; margin-bottom: 12px; }
.composer-corps input, .composer-corps textarea, .composer-channel input, .composer-channel textarea, .composer-corps select { width: 100%; }
.composer-preview { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-top: 12px; background: #fffef8; }
.composer-publish { margin-top: 24px; border-top: 1px solid #ddd; padding-top: 16px; }
.channel-row { display: grid; grid-template-columns: 160px 90px 1fr; align-items: center; gap: 12px; padding: 8px 0; }
.channel-state { font-size: 12px; text-transform: uppercase; opacity: .7; }
.channel-state--published, .channel-state--sent { color: #2e7d32; opacity: 1; }
.composer-insta-kit pre { white-space: pre-wrap; background: #f6f0e2; padding: 12px; border-radius: 8px; }
.composer-error { color: #b00020; }
.composer-hint { font-size: 13px; opacity: .7; }
.composer-new { padding: 24px; max-width: 480px; }
.composer-new label { display: block; margin-bottom: 14px; }
.composer-new input, .composer-new select { width: 100%; }
```

- [ ] **Step 6 : components/annonces/AnnouncementsList.tsx (historique)**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Announcement } from '../../types/announcement'

export function AnnouncementsList() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc('list_announcements_admin')
        setItems((data ?? []) as Announcement[])
      } finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <div className="loading">Chargement…</div>
  return (
    <div style={{ padding: 16 }}>
      <div className="page-header">
        <h1>Annonces</h1>
        <Link to="/annonces/nouvelle"><button>Nouvelle annonce</button></Link>
      </div>
      <table className="announcements-table">
        <thead><tr><th>Titre</th><th>Type</th><th>Statut</th><th>Canaux</th><th>Date</th></tr></thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id}>
              <td><Link to={`/annonces/${a.id}`}>{a.title}</Link></td>
              <td>{a.type}</td>
              <td>{a.status}</td>
              <td>{Object.entries(a.channels).filter(([,v]) => v !== 'none').map(([k,v]) => `${k}:${v}`).join(' · ') || '—'}</td>
              <td>{a.published_at ? new Date(a.published_at).toLocaleDateString('fr-FR') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7 : App.tsx (hub) — routes**

Imports :
```tsx
import { AnnouncementsList } from './components/annonces/AnnouncementsList'
import { ComposerAnnonce } from './components/annonces/ComposerAnnonce'
```
Routes (dans `<Routes>`) :
```tsx
          <Route path="/annonces" element={<AnnouncementsList />} />
          <Route path="/annonces/nouvelle" element={<ComposerAnnonce />} />
          <Route path="/annonces/:id" element={<ComposerAnnonce />} />
```

- [ ] **Step 8 : Sidebar.tsx (hub) — entrée**

Dans la section « La Carte » (ou une nouvelle section « Communication ») :
```tsx
        <NavLink to="/annonces" className={({ isActive }) => isActive ? 'active' : ''}>
          Annonces
        </NavLink>
```

- [ ] **Step 9 : Build hub**

```bash
pnpm --filter hub build
```
Expected : build sans erreur TS.

- [ ] **Step 10 : Commit**

```bash
git add apps/hub
git commit -m "feat(annonces): Composer multi-canal + historique dans le Hub"
```

---

## Task 7 : Builds verts, version bump, push par lot

- [ ] **Step 1 : Build complet des deux apps**

```bash
pnpm --filter explore-web build
pnpm --filter hub build
```
Expected : les deux builds passent (tsc strict + vite).

- [ ] **Step 2 : Bump version explore-web** (préférence globale Uriel — patch)

Localiser le `version.ts` / `APP_VERSION` d'explore-web (cf. `scripts/release.mjs`) et bumper le patch. Vérifier le mécanisme exact avant d'éditer.

- [ ] **Step 3 : Push (fin de lot)**

```bash
git push
```

- [ ] **Step 4 : Mettre à jour la mémoire**
- `apps/explore-web/src/...` nouveau dossier de pages → noter dans `apps/explore-web/CLAUDE.md` (règle E3) si pertinent.
- Citadelle : créer/mettre à jour `📣 Communication/INDEX - Communication` avec un pointeur vers la feature + statut Phase 1, et entrée `log.md`.

---

## Self-Review (couverture spec)

| Section spec | Couvert par |
|---|---|
| Hub = source de vérité (Supabase) | Task 1 (table + RPCs admin, RLS no-direct-write) |
| Synchro Hub → Shopify sens unique | Task 5 (function create/update par `shopify_article_id`) |
| Lecteur app `/article/:slug` + liste Nouvelles | Task 4 |
| Push broadcast (réutilise Push V1, `push_important_enabled`) | Task 2 + Task 3 |
| Kit Instagram (généré → collé) | Task 6 (onglet Insta + copier) |
| Blog Shopify 1-clic | Task 5 + Task 6 (bouton Blog) |
| Champ `audience` posé dès v1 (`tout-le-monde`) | Task 1 (colonne + défaut) |
| `channels` jsonb état par canal | Task 1 (colonne) + `set_announcement_channel` |
| Composer Hub (déclencher → éditer → publier → historique) | Task 6 |
| Email (Phase 2) | **Hors scope Phase 1** (table `contacts` + Resend campagne) — laissé à Phase 2 |
| Segmentation v2 | Hors scope (champ `audience` prêt) |

**Questions ouvertes traçées (pour Uriel) :**
1. Génération de brouillons par IA (câbler API Claude ?) — décision 1.
2. Scope du token Shopify (`write_content` ?) + `shopify_blog_id` — Task 5.
3. Opt-out push dédié vs `push_important_enabled` — décision 3.
4. WYSIWYG vs Markdown — décision 2.
5. Emplacement « Nouvelles » : menu Plus vs cellule tabbar — Task 4 Step 12.
