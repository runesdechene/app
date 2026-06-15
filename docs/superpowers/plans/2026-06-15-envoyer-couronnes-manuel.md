# Envoyer des Couronnes à un joueur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un admin de créditer manuellement des Couronnes à un joueur depuis le hub (page joueur), avec un motif, en déclenchant un email Resend et une notification in-app expliquant la récompense.

**Architecture:** Une RPC admin `award_crowns_manual` crédite `user_crowns` sans plafond et insère une notif `crowns_awarded` (porteuse du montant + motif). Le trigger `email_on_notification` existant route vers l'edge function `send-email`, qui gagne une branche pour ce type. Le hub appelle la RPC depuis `UserDetail`; l'app `explore-web` rend le nouveau type de notif.

**Tech Stack:** Supabase (Postgres plpgsql, Edge Function Deno + Resend), React 18 + TypeScript strict (Vite), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-envoyer-couronnes-manuel-design.md`

**Schéma vérifié (2026-06-15) :** `user_crowns(user_id text, balance int, updated_at timestamptz)` · `notifications(id int, recipient_id text, type text, data jsonb, read bool, created_at timestamptz)` · `users.id` = varchar. Helper admin `public._is_admin()` existe (mig 219).

---

### Task 1: SQL — RPC `award_crowns_manual`

**Files:**
- Create: `supabase/migrations/255_award_crowns_manual.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 255_award_crowns_manual.sql
-- WHY : Récompense MANUELLE admin (spec 2026-06-15). Crédite des Couronnes à un
-- joueur depuis le hub avec un motif, SANS plafond (un don admin est volontaire,
-- contrairement aux récompenses auto plafonnées à 500). Insère une notif
-- 'crowns_awarded' (montant + motif) qui déclenche l'email Resend via le trigger
-- email_on_notification existant (mig 175) et s'affiche in-app. Canal distinct
-- des récompenses UGC : ne touche ni contributions_count ni la Gloire.

CREATE OR REPLACE FUNCTION public.award_crowns_manual(
  p_user_id text,
  p_amount  int,
  p_reason  text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason  text;
  v_balance int;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF coalesce(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'amount_must_be_positive'; END IF;

  v_reason := btrim(coalesce(p_reason, ''));
  IF v_reason = '' THEN RAISE EXCEPTION 'reason_required'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Crédit SANS plafond (pas de LEAST(500, ...)).
  INSERT INTO public.user_crowns (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = public.user_crowns.balance + p_amount,
    updated_at = now()
  RETURNING balance INTO v_balance;

  INSERT INTO public.notifications (recipient_id, type, data)
  VALUES (p_user_id, 'crowns_awarded',
          jsonb_build_object('crowns', p_amount, 'reason', v_reason));

  RETURN jsonb_build_object('balance', v_balance);
END; $$;
GRANT EXECUTE ON FUNCTION public.award_crowns_manual(text, int, text) TO authenticated;
```

- [ ] **Step 2: Preview (nouvelle fonction)**

Run: `node scripts/migration-preview.mjs supabase/migrations/255_award_crowns_manual.sql`
Expected: liste `award_crowns_manual` en "Nouvelles fonctions : 1" (pas de régression sur une fonction existante).

- [ ] **Step 3: Dry-run puis apply**

Run: `npx supabase db push --dry-run --linked`
Expected: `Would push these migrations: • 255_award_crowns_manual.sql`
Puis: `npx supabase db push --linked`
Expected: `Applying migration 255_award_crowns_manual.sql...` puis `Finished`.

- [ ] **Step 4: Vérifier la signature en prod**

Via MCP `execute_sql` (project ukpapqssgsxirsgmcvof) :
```sql
select pg_get_function_identity_arguments('public.award_crowns_manual(text,int,text)'::regprocedure) as sig;
```
Expected: `p_user_id text, p_amount integer, p_reason text`.

> Note : le happy-path ne peut PAS être testé via MCP (la garde `_is_admin()` lit `auth.uid()`, NULL en service_role → `admin_only`). Le test fonctionnel se fait manuellement au hub en Task 4 (Uriel est admin).

- [ ] **Step 5: Commit**

```bash
git add "supabase/migrations/255_award_crowns_manual.sql"
git commit -m "feat(db): RPC award_crowns_manual — récompense Couronnes manuelle + notif"
```
Ajouter un 2e `-m` : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
Note : post-commit hook relance graphify-sql (commit touche `supabase/migrations/`) — sortie verbeuse normale.

---

### Task 2: Edge function — branche email `crowns_awarded`

**Files:**
- Modify: `supabase/functions/send-email/index.ts`

- [ ] **Step 1: Ajouter le renderer `renderCrownsAwarded`**

Dans `supabase/functions/send-email/index.ts`, juste APRÈS la fonction `renderContributionApproved` (avant `serve(`), ajouter :

```typescript
function renderCrownsAwarded(firstName: string, crowns: number, reason: string): { subject: string; html: string } {
  const name = firstName?.trim() || 'Ami du Mouvement'
  const safeReason = (reason || '').trim()
  return {
    subject: `Tu as reçu ${crowns} Couronnes ⚜️`,
    html: `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#e3d4b6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9ddc7;background:linear-gradient(180deg,#efe4cf 0%,#e1d1b2 100%);padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#f7f1e3;border:1px solid #d8c39a;border-radius:16px;overflow:hidden;box-shadow:0 18px 44px rgba(40,30,16,0.20);">
        <tr><td style="height:6px;background:linear-gradient(90deg,#b8945a,#9a7b41,#cda86a);font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:36px 40px 0;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:6px;color:#9a7b41;text-transform:uppercase;">Runes de Chêne</div>
          <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;color:#b6a07a;text-transform:uppercase;margin-top:8px;">⚜&nbsp;&nbsp;Le Mouvement&nbsp;&nbsp;⚜</div>
        </td></tr>
        <tr><td align="center" style="padding:26px 44px 0;">
          <h1 style="margin:0;font-family:Georgia,'Hoefler Text',serif;font-weight:normal;font-size:30px;line-height:1.2;color:#2b2114;">Bravo, ${name}.</h1>
          <p style="margin:14px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#5b4d38;">Tu viens d'être récompensé par l'équipe Runes de Chêne.</p>
        </td></tr>
        <tr><td align="center" style="padding:30px 0 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" width="152" height="152" style="width:152px;height:152px;background:#241d12;background:radial-gradient(circle at 50% 36%,#352a19,#1b150c);border:2px solid #b8945a;border-radius:50%;">
            <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;color:#c8ad79;text-transform:uppercase;">Créditées</div>
            <div style="font-family:Georgia,'Hoefler Text',serif;font-size:48px;line-height:1;color:#e8cd92;padding:4px 0;">+${crowns}</div>
            <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:2px;color:#c8ad79;text-transform:uppercase;">Couronnes</div>
          </td></tr></table>
        </td></tr>
        ${safeReason ? `<tr><td align="center" style="padding:22px 48px 0;">
          <div style="font-family:Georgia,serif;font-size:11px;letter-spacing:3px;color:#9a7b41;text-transform:uppercase;">Pour</div>
          <p style="margin:6px 0 0;font-family:Georgia,serif;font-size:17px;line-height:1.5;color:#2b2114;font-style:italic;">${safeReason}</p>
        </td></tr>` : ''}
        <tr><td align="center" style="padding:18px 48px 0;">
          <p style="margin:0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#5b4d38;">Tes Couronnes t'attendent sur <strong style="color:#2b2114;">l'application</strong>.<br>Connecte-toi avec cet email pour les dépenser.</p>
        </td></tr>
        <tr><td align="center" style="padding:28px 0 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border-radius:10px;background:#8a6d3b;background:linear-gradient(180deg,#a9874c,#876a39);box-shadow:0 6px 16px rgba(138,109,59,0.40);">
            <a href="https://app.runesdechene.com" style="display:inline-block;padding:15px 36px;font-family:Georgia,serif;font-size:16px;color:#fff7e8;text-decoration:none;letter-spacing:.5px;">Ouvrir l'application&nbsp;→</a>
          </td></tr></table>
        </td></tr>
        <tr><td align="center" style="padding:30px 48px 0;"><div style="font-size:13px;color:#c4ac80;letter-spacing:5px;">✦&nbsp;⚜&nbsp;✦</div></td></tr>
        <tr><td align="center" style="padding:14px 48px 38px;">
          <p style="margin:0;font-family:Georgia,serif;font-size:12px;line-height:1.6;color:#9b8b6e;font-style:italic;">Tu reçois ce message car tu es membre du Mouvement Runes de Chêne.<br>À très vite sur les chemins.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }
}
```

- [ ] **Step 2: Router le nouveau type dans `serve`**

Dans `serve(...)`, REMPLACER ce bloc :

```typescript
  if (body.type !== 'contribution_approved') return ok()

  const { data: user, error } = await supabase
    .from('users')
    .select('email_address, first_name')
    .eq('id', body.recipient_id)
    .single()
  if (error || !user?.email_address) { console.warn('user_lookup_failed', error); return ok() }

  const crowns = Number((body.data as { crowns?: number })?.crowns ?? 0)
  const { subject, html } = renderContributionApproved(user.first_name ?? '', crowns)
```

PAR :

```typescript
  if (body.type !== 'contribution_approved' && body.type !== 'crowns_awarded') return ok()

  const { data: user, error } = await supabase
    .from('users')
    .select('email_address, first_name')
    .eq('id', body.recipient_id)
    .single()
  if (error || !user?.email_address) { console.warn('user_lookup_failed', error); return ok() }

  const crowns = Number((body.data as { crowns?: number })?.crowns ?? 0)
  const reason = String((body.data as { reason?: string })?.reason ?? '')
  const { subject, html } = body.type === 'crowns_awarded'
    ? renderCrownsAwarded(user.first_name ?? '', crowns, reason)
    : renderContributionApproved(user.first_name ?? '', crowns)
```

(Le reste de `serve` — appel Resend, logs — inchangé.)

- [ ] **Step 3: Déployer la fonction**

Run: `npx supabase functions deploy send-email`
Expected: `Deployed Functions on project ukpapqssgsxirsgmcvof: send-email` (ou équivalent succès).

- [ ] **Step 4: Commit**

```bash
git add "supabase/functions/send-email/index.ts"
git commit -m "feat(email): send-email gère le type crowns_awarded (montant + motif)"
```
Ajouter un 2e `-m` : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 3: App — rendu de la notif `crowns_awarded`

**Files:**
- Modify: `apps/explore-web/src/stores/notificationStore.ts`
- Modify: `apps/explore-web/src/components/notifications/NotificationPanel.tsx`
- Test: `apps/explore-web/src/lib/notificationTarget.test.ts`

- [ ] **Step 1: Écrire le test (clic = no-op)**

Dans `apps/explore-web/src/lib/notificationTarget.test.ts`, ajouter dans le `describe('resolveNotificationTarget', ...)` :

```typescript
  it('crowns_awarded → none (pas de cible, clic no-op)', () => {
    expect(resolveNotificationTarget(notif('crowns_awarded', { crowns: 50, reason: 'Merci' }))).toEqual(
      { kind: 'none' }
    )
  })
```

- [ ] **Step 2: Lancer le test (doit PASSER d'emblée)**

Run: `pnpm --filter explore-web exec vitest run src/lib/notificationTarget.test.ts`
Expected: PASS — `resolveNotificationTarget` retourne déjà `{ kind: 'none' }` pour un type sans `placeId`. Ce test verrouille ce comportement avant qu'on ajoute le type à l'union.

- [ ] **Step 3: Ajouter le type + champs au store**

Dans `apps/explore-web/src/stores/notificationStore.ts`, dans l'union `type:`, ajouter une ligne après `| 'place_position_edited'` :

```typescript
    // Récompense Couronnes manuelle (admin)
    | 'crowns_awarded'
```

Et dans l'interface `data: { ... }`, ajouter après `sample_names_csv?: string` :

```typescript
    // Récompense Couronnes manuelle
    crowns?: number
    reason?: string
```

- [ ] **Step 4: Icône + message dans le panneau**

Dans `apps/explore-web/src/components/notifications/NotificationPanel.tsx` :

(a) Dans `TYPE_ICONS`, ajouter une entrée pour `crowns_awarded` à la fin de l'objet (après l'entrée existante dont la clé est `place_position_edited`). Le fichier écrit les emojis en échappement unicode — suivre ce style (🪙 = U+1FA99) :

```typescript
  crowns_awarded: '🪙',               // 🪙
```

(b) Dans `formatMessage`, ajouter ce `case` juste avant la fin du `switch` (après le `case 'place_position_edited'`) :

```typescript
    case 'crowns_awarded':
      return d.reason
        ? `Tu as reçu ${d.crowns ?? 0} 🪙 — ${d.reason}`
        : `Tu as reçu ${d.crowns ?? 0} 🪙`
```

- [ ] **Step 5: Build**

Run: `pnpm --filter explore-web build`
Expected: build OK, aucune erreur TS (le `case` rend `string`, l'union est exhaustive).

- [ ] **Step 6: Commit**

```bash
git add "apps/explore-web/src/stores/notificationStore.ts" "apps/explore-web/src/components/notifications/NotificationPanel.tsx" "apps/explore-web/src/lib/notificationTarget.test.ts"
git commit -m "feat(app): rendu in-app de la notif crowns_awarded (icône + message)"
```
Ajouter un 2e `-m` : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 4: Hub — encart « Envoyer des Couronnes » sur `UserDetail`

**Files:**
- Modify: `apps/hub/src/components/UserDetail.tsx`
- Modify: `apps/hub/src/App.css`

- [ ] **Step 1: Ajouter l'état local**

Dans `UserDetail.tsx`, dans le composant `UserDetail`, après la ligne `const [error, setError] = useState<string | null>(null)`, ajouter :

```typescript
  const [awardAmount, setAwardAmount] = useState('')
  const [awardReason, setAwardReason] = useState('')
  const [awarding, setAwarding] = useState(false)
  const [awardError, setAwardError] = useState<string | null>(null)
  const [awardOk, setAwardOk] = useState<string | null>(null)
```

- [ ] **Step 2: Ajouter le handler d'envoi**

Dans `UserDetail.tsx`, après la fonction `fetchAll()` (avant le premier `if (loading)`), ajouter :

```typescript
  async function handleAward() {
    const amount = parseInt(awardAmount, 10)
    const reason = awardReason.trim()
    if (!user || !Number.isFinite(amount) || amount <= 0 || !reason) return
    if (!window.confirm(`Envoyer ${amount} 🪙 à ${user.display_name || user.first_name || user.email_address} ? Un email lui sera envoyé.`)) return

    setAwarding(true)
    setAwardError(null)
    setAwardOk(null)
    try {
      const { error: e } = await supabase.rpc('award_crowns_manual', {
        p_user_id: user.id,
        p_amount: amount,
        p_reason: reason,
      })
      if (e) { setAwardError(e.message); return }
      setAwardAmount('')
      setAwardReason('')
      setAwardOk(`+${amount} 🪙 envoyées`)
      await fetchAll()
    } finally {
      setAwarding(false)
    }
  }
```

- [ ] **Step 3: Ajouter l'encart dans le JSX**

Dans `UserDetail.tsx`, juste APRÈS la fermeture de la grille `</div>` du bloc `{/* Info cards */}` (la `</div>` qui ferme `<div className="ud-cards">`) et AVANT le bloc `{/* Fragments */}`, insérer :

```tsx
      {/* Envoyer des Couronnes */}
      <div className="ud-section">
        <h2>Envoyer des Couronnes</h2>
        <div className="ud-award">
          <input
            type="number"
            min={1}
            className="ud-award-amount"
            placeholder="Montant"
            value={awardAmount}
            onChange={e => setAwardAmount(e.target.value)}
          />
          <input
            type="text"
            className="ud-award-reason"
            placeholder="Motif (ex. Gagnant du concours de juin)"
            value={awardReason}
            onChange={e => setAwardReason(e.target.value)}
          />
          <button
            className="ud-award-btn"
            onClick={handleAward}
            disabled={awarding || !awardReason.trim() || !(parseInt(awardAmount, 10) > 0)}
          >
            {awarding ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
        {awardError && <p className="ud-error">{awardError}</p>}
        {awardOk && <p className="ud-award-ok">{awardOk}</p>}
      </div>
```

- [ ] **Step 4: Styles**

Dans `apps/hub/src/App.css`, ajouter en fin de fichier :

```css
.ud-award {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.ud-award-amount {
  width: 110px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
}
.ud-award-reason {
  flex: 1;
  min-width: 220px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
}
.ud-award-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 6px;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.ud-award-btn:disabled { opacity: .5; cursor: not-allowed; }
.ud-award-ok { color: var(--color-primary); margin-top: 8px; }
```

- [ ] **Step 5: Build**

Run: `pnpm --filter hub build`
Expected: build OK, aucune erreur TS.

- [ ] **Step 6: Vérification manuelle (happy-path complet)**

1. `pnpm --filter hub dev`, se connecter en admin, aller dans **Users** → chercher un joueur de test (idéalement toi-même ou un compte avec un email que tu contrôles) → ouvrir sa fiche.
2. Saisir un montant (ex. 5) + un motif → **Envoyer** → confirmer.
3. Vérifier : la carte **Couronnes** se met à jour (+5), message « +5 🪙 envoyées ».
4. Vérifier l'email reçu (Resend) : montant + motif affichés.
5. Dans l'app (`app.runesdechene.com` ou `pnpm --filter explore-web dev`), ouvrir les notifications du joueur → ligne « Tu as reçu 5 🪙 — <motif> » avec l'icône 🪙.

- [ ] **Step 7: Commit**

```bash
git add "apps/hub/src/components/UserDetail.tsx" "apps/hub/src/App.css"
git commit -m "feat(hub): encart Envoyer des Couronnes sur la fiche joueur"
```
Ajouter un 2e `-m` : `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Notes de fin

- **Déploiement** (manuel, après validation) :
  - Hub : `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build`
  - App : `cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build`
  - L'edge function `send-email` est déjà déployée en Task 2 (canal Supabase, pas Netlify).
- **Push par lot** en fin de session (règle Citadelle).
- **Ordre** : Task 1 (RPC) et Task 2 (email) avant Task 4 (le hub appelle la RPC + déclenche l'email). Task 3 (app) est indépendante.
