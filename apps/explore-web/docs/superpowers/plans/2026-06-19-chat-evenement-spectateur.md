# Chat d'événement visible en lecture seule (spectateurs) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le chat d'un événement (expédition) lisible par les non-participants en lecture seule, avec un bandeau « tu observes » + CTA « Rejoindre l'équipage », sans toucher au serveur.

**Architecture:** Changement 100% front. On extrait les règles d'accès (visibilité / droit d'écriture) dans un helper pur testé (vitest, env node — pattern existant du repo). On lève la garde de visibilité du chat dans `ExpeditionModal`, on rend l'input conditionné à l'appartenance dans `ExpeditionChat` (bandeau spectateur sinon), et on empêche le suivi de lecture (`markRead`) pour les spectateurs dans `useExpeditionChat`.

**Tech Stack:** React 18 + TypeScript strict, Vitest (logique pure), Supabase JS (déjà câblé), CSS par composant dans `ExpeditionModal.css`.

---

## File Structure

- **Create** `src/lib/expeditionChatAccess.ts` — helper pur : `isChatVisible(status)` + `canWriteChat(myStatus)`. Une seule responsabilité : encoder les règles d'accès au chat.
- **Create** `src/lib/expeditionChatAccess.test.ts` — tests unitaires du helper.
- **Modify** `src/hooks/useExpeditionChat.ts` — nouveau paramètre `trackRead` pour ne pas marquer lu côté spectateur.
- **Modify** `src/components/expeditions/ExpeditionChat.tsx` — prop `canWrite` + `onJoin`, bandeau spectateur, transmission de `trackRead`.
- **Modify** `src/components/expeditions/ExpeditionModal.tsx` — câblage : `chatVisible` sans `isMember`, props passées au chat, libellé header, handler `onJoin` + scroll vers section candidature.
- **Modify** `src/components/expeditions/ExpeditionModal.css` — styles du bandeau spectateur (desktop + mobile fixed).
- **Modify** `CHANGELOG.md` — bump version (V0.9.75).

---

## Task 1: Helper d'accès pur + tests

**Files:**
- Create: `src/lib/expeditionChatAccess.ts`
- Test: `src/lib/expeditionChatAccess.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/lib/expeditionChatAccess.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { isChatVisible, canWriteChat } from './expeditionChatAccess'

describe('isChatVisible', () => {
  it('visible quand published', () => {
    expect(isChatVisible('published')).toBe(true)
  })
  it('visible quand passed (event + 7j)', () => {
    expect(isChatVisible('passed')).toBe(true)
  })
  it('invisible quand archived', () => {
    expect(isChatVisible('archived')).toBe(false)
  })
  it('invisible quand cancelled', () => {
    expect(isChatVisible('cancelled')).toBe(false)
  })
})

describe('canWriteChat', () => {
  it('le chef écrit', () => {
    expect(canWriteChat('chief')).toBe(true)
  })
  it('un participant validé écrit', () => {
    expect(canWriteChat('validated')).toBe(true)
  })
  it('un pending ne peut pas écrire (spectateur)', () => {
    expect(canWriteChat('pending')).toBe(false)
  })
  it('un non-participant (null) ne peut pas écrire', () => {
    expect(canWriteChat(null)).toBe(false)
  })
  it('un rejected/withdrawn ne peut pas écrire', () => {
    expect(canWriteChat('rejected')).toBe(false)
    expect(canWriteChat('withdrawn')).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `cd apps/explore-web && pnpm test -- expeditionChatAccess`
Expected: FAIL — `Failed to resolve import "./expeditionChatAccess"` / module introuvable.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `src/lib/expeditionChatAccess.ts` :

```ts
/**
 * Règles d'accès au chat d'une expédition (événement).
 *
 * - Visibilité : le chat est lisible par TOUT utilisateur tant que l'expédition
 *   est sur la carte (`published` ou `passed`). À `archived`/`cancelled` il
 *   disparaît pour tous. La lecture par les non-participants est volontaire
 *   (spectateurs) — voir spec 2026-06-19-chat-evenement-spectateur-design.md.
 * - Écriture : réservée au chef et aux participants validés. (Le serveur
 *   `send_voyage_message` applique déjà cette règle ; ceci en est le miroir UI.)
 */

import type { ExpeditionStatus, ParticipantStatus } from '../types/expedition'

/** Type du champ `my_status` du payload `get_voyage` (cf. types/expedition.ts). */
export type ChatMyStatus = 'chief' | ParticipantStatus | null

export function isChatVisible(status: ExpeditionStatus): boolean {
  return status === 'published' || status === 'passed'
}

export function canWriteChat(myStatus: ChatMyStatus): boolean {
  return myStatus === 'chief' || myStatus === 'validated'
}
```

> Types confirmés dans `src/types/expedition.ts` : `ExpeditionStatus = 'published' | 'passed' | 'archived' | 'cancelled'` (l.5), `ParticipantStatus = 'pending' | 'validated' | 'rejected' | 'withdrawn'` (l.7), et `my_status: 'chief' | ParticipantStatus | null` (l.94). Aucun `any`.

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `cd apps/explore-web && pnpm test -- expeditionChatAccess`
Expected: PASS — 11 tests verts.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/lib/expeditionChatAccess.ts apps/explore-web/src/lib/expeditionChatAccess.test.ts
git commit -m "feat(expeditions): helper pur d'accès au chat (visibilité + écriture)"
```

---

## Task 2: `useExpeditionChat` — ne pas marquer lu pour les spectateurs

**Files:**
- Modify: `src/hooks/useExpeditionChat.ts`

Le hook appelle `markExpeditionMessagesRead` à deux endroits (sur chaque INSERT live, l.80 ; et au mount + refresh liste, l.110-115). Un spectateur ne doit déclencher AUCUN des deux (pas d'enregistrement de lecture, pas de manip du badge non-lu).

- [ ] **Step 1: Ajouter le paramètre `trackRead`**

Dans `src/hooks/useExpeditionChat.ts`, modifier la signature :

```ts
export function useExpeditionChat(expeditionId: string | null, trackRead = true) {
```

Et ajouter `trackRead` au tableau de dépendances du `useEffect` (dernière ligne du hook) :

```ts
  }, [expeditionId, trackRead])
```

- [ ] **Step 2: Garder le markRead sur INSERT live**

Remplacer (dans le callback `postgres_changes`, ~l.80) :

```ts
          store.addMessage(expeditionId!, rowToMessage(payload.new as Record<string, unknown>))
          markExpeditionMessagesRead(expeditionId!).catch(() => {})
```

par :

```ts
          store.addMessage(expeditionId!, rowToMessage(payload.new as Record<string, unknown>))
          if (trackRead) markExpeditionMessagesRead(expeditionId!).catch(() => {})
```

- [ ] **Step 3: Garder le markRead du mount**

Remplacer le bloc (~l.109-115) :

```ts
    // Mark read au mount + refresh la liste pour effacer la pastille
    markExpeditionMessagesRead(expeditionId!)
      .then(() => listUpcomingExpeditions())
      .then((list) => {
        if (!cancelled) useExpeditionsStore.getState().setUpcoming(list)
      })
      .catch(() => {})
```

par :

```ts
    // Mark read au mount + refresh la liste pour effacer la pastille.
    // Spectateurs (trackRead=false) : on ne touche ni aux lectures ni au badge.
    if (trackRead) {
      markExpeditionMessagesRead(expeditionId!)
        .then(() => listUpcomingExpeditions())
        .then((list) => {
          if (!cancelled) useExpeditionsStore.getState().setUpcoming(list)
        })
        .catch(() => {})
    }
```

- [ ] **Step 4: Vérifier la compilation**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: PASS (aucune erreur). `trackRead` a une valeur par défaut → les appels existants restent valides.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/hooks/useExpeditionChat.ts
git commit -m "feat(expeditions): useExpeditionChat ne marque pas lu pour les spectateurs"
```

---

## Task 3: `ExpeditionChat` — droit d'écriture + bandeau spectateur

**Files:**
- Modify: `src/components/expeditions/ExpeditionChat.tsx`

Rappel : la prop `readOnly` a été retirée précédemment. On introduit maintenant `canWrite` (lié à l'appartenance, pas au statut) + `onJoin` optionnel (CTA affiché uniquement si rejoindre est possible).

- [ ] **Step 1: Étendre l'interface Props**

Dans `src/components/expeditions/ExpeditionChat.tsx`, dans `interface Props`, ajouter après `participantsById` :

```ts
  /** L'utilisateur courant peut-il écrire ? (chef ou participant validé) */
  canWrite: boolean
  /** Handler « Rejoindre l'équipage » — fourni uniquement si rejoindre est
   *  possible (sinon le bandeau spectateur n'affiche pas de bouton). */
  onJoin?: () => void
```

- [ ] **Step 2: Récupérer les nouvelles props + transmettre `trackRead`**

Modifier la signature de la fonction :

```ts
export function ExpeditionChat({ expeditionId, participantsById, canWrite, onJoin, onAuthorClick, active = true }: Props) {
  useExpeditionChat(expeditionId, canWrite)
```

(`canWrite` sert de `trackRead` : seuls les membres marquent les messages lus.)

- [ ] **Step 3: Conditionner l'input et ajouter le bandeau spectateur**

Remplacer le bloc input actuel :

```tsx
      <div className="expedition-chat-input">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message…"
          maxLength={500}
        />
        <button onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Envoyer">↑</button>
      </div>
```

par :

```tsx
      {canWrite ? (
        <div className="expedition-chat-input">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message…"
            maxLength={500}
          />
          <button onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Envoyer">↑</button>
        </div>
      ) : (
        <div className="expedition-chat-spectator">
          <span className="expedition-chat-spectator-label">👁️ Tu observes cet événement</span>
          {onJoin && (
            <button className="expedition-chat-spectator-join" onClick={onJoin}>
              Rejoindre l'équipage
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: ÉCHEC attendu sur `ExpeditionModal.tsx` (props `canWrite`/`onJoin` pas encore fournies) — c'est normal, corrigé en Task 4. Le fichier `ExpeditionChat.tsx` lui-même ne doit pas avoir d'erreur propre.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/expeditions/ExpeditionChat.tsx
git commit -m "feat(expeditions): chat en lecture seule + bandeau spectateur (canWrite/onJoin)"
```

---

## Task 4: `ExpeditionModal` — câblage complet

**Files:**
- Modify: `src/components/expeditions/ExpeditionModal.tsx`

- [ ] **Step 1: Importer le helper de visibilité**

Après l'import de `formatRelativeRdv` (~l.23), ajouter :

```ts
import { isChatVisible } from '../../lib/expeditionChatAccess'
```

- [ ] **Step 2: Lever la garde `isMember` sur `chatVisible`**

Remplacer (l.185) :

```ts
  const chatVisible = isMember && (e.status === 'published' || e.status === 'passed')
```

par :

```ts
  // Le chat est lisible par TOUS (spectateurs en lecture seule) tant que
  // l'événement est sur la carte. L'écriture reste réservée aux membres (isMember).
  const chatVisible = isChatVisible(e.status)
```

(`isMember` reste défini l.128 et sert désormais à `canWrite` ci-dessous.)

- [ ] **Step 3: Ajouter une ref pour scroller vers la section candidature**

Ajouter `useRef` à l'import React (l.1) :

```ts
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
```

Dans le corps du composant, près des autres hooks d'état (~l.55), déclarer la ref :

```ts
  const requestSectionRef = useRef<HTMLElement | null>(null)
```

- [ ] **Step 4: Écrire le handler `onJoin`**

Après `handleRequest` (~l.156), ajouter :

```ts
  // CTA « Rejoindre l'équipage » depuis le chat spectateur.
  // - validation libre → rejoint immédiatement.
  // - sinon → amène vers la section « Demande à rejoindre » (bascule tab Infos
  //   sur mobile, puis scroll vers le formulaire existant).
  function handleJoinFromChat() {
    if (e.validation_mode === 'free') {
      handleRequest()
      return
    }
    if (isMobile) setMobileTab('info')
    // Laisse le tab se rendre avant de scroller.
    setTimeout(() => {
      requestSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
```

- [ ] **Step 5: Attacher la ref à la section candidature**

Localiser la section (~l.491) :

```tsx
        {canRequest && (
          <section className="expedition-modal-request">
```

la remplacer par :

```tsx
        {canRequest && (
          <section className="expedition-modal-request" ref={requestSectionRef}>
```

- [ ] **Step 6: Passer les nouvelles props à `<ExpeditionChat>`**

Remplacer le montage du chat (~l.554-565) :

```tsx
            <ExpeditionChat
              expeditionId={expeditionId}
              participantsById={participantsById}
              onAuthorClick={openProfile}
              active={chatActive}
            />
```

par :

```tsx
            <ExpeditionChat
              expeditionId={expeditionId}
              participantsById={participantsById}
              canWrite={isMember}
              onJoin={canRequest ? handleJoinFromChat : undefined}
              onAuthorClick={openProfile}
              active={chatActive}
            />
```

(`onJoin` n'est fourni que si `canRequest` — donc pas de bouton « Rejoindre » sur un événement `passed` où rejoindre n'est plus possible.)

- [ ] **Step 7: Renommer le libellé du header chat (retirer « privé »)**

Localiser (~l.556-557) :

```tsx
            <div className="expedition-modal-chat-col-header">
              <h3>Préparation · chat privé</h3>
            </div>
```

remplacer par :

```tsx
            <div className="expedition-modal-chat-col-header">
              <h3>Préparation · chat de l'équipage</h3>
            </div>
```

- [ ] **Step 8: Vérifier la compilation**

Run: `cd apps/explore-web && pnpm exec tsc --noEmit`
Expected: PASS — plus aucune erreur (les props du chat sont fournies).

- [ ] **Step 9: Commit**

```bash
git add apps/explore-web/src/components/expeditions/ExpeditionModal.tsx
git commit -m "feat(expeditions): chat visible aux spectateurs + CTA rejoindre + libellé"
```

---

## Task 5: Styles du bandeau spectateur

**Files:**
- Modify: `src/components/expeditions/ExpeditionModal.css`

- [ ] **Step 1: Ajouter les styles desktop**

Juste après la règle `.expedition-chat-input button:disabled { … }` (~l.1237), ajouter :

```css
/* ─────────── Bandeau spectateur (non-membre, lecture seule) ─────────── */
.expedition-chat-spectator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid rgba(184, 154, 106, 0.3);
  background: #f5e9d4;
  flex-shrink: 0;
}
.expedition-chat-spectator-label {
  font-family: var(--font-body);
  font-size: 14px;
  color: #6b5836;
}
.expedition-chat-spectator-join {
  background: #2a1f10;
  color: #faf2dd;
  border: none;
  padding: 9px 16px;
  border-radius: 18px;
  font-family: var(--font-body);
  font-size: 14px;
  cursor: pointer;
  flex-shrink: 0;
}
.expedition-chat-spectator-join:hover { background: #3a2c16; }
```

- [ ] **Step 2: Ajouter la parité mobile (fixed en bas, comme l'input)**

Dans le `@media (max-width: 760px)` qui contient déjà `.expedition-modal.mobile-tab-chat .expedition-chat-input` (~l.218), ajouter le même sélecteur pour le bandeau. Remplacer :

```css
  .expedition-modal.mobile-tab-chat .expedition-chat-input {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10011;
    padding-bottom: calc(var(--safe-bottom, 0px) + 12px);
    background: #f5e9d4;
  }
```

par :

```css
  .expedition-modal.mobile-tab-chat .expedition-chat-input,
  .expedition-modal.mobile-tab-chat .expedition-chat-spectator {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10011;
    padding-bottom: calc(var(--safe-bottom, 0px) + 12px);
    background: #f5e9d4;
  }
```

- [ ] **Step 3: Vérifier visuellement (build)**

Run: `cd apps/explore-web && pnpm build`
Expected: `✓ built` sans erreur TS.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/expeditions/ExpeditionModal.css
git commit -m "style(expeditions): bandeau spectateur du chat (desktop + mobile)"
```

---

## Task 6: Bump version (changelog) + build final

**Files:**
- Modify: `CHANGELOG.md` (à la racine de `apps/explore-web`)

- [ ] **Step 1: Ajouter l'entrée en tête du changelog**

En tête de `apps/explore-web/CHANGELOG.md`, AVANT `# ALPHA V0.9.74`, insérer :

```markdown
# ALPHA V0.9.75
## Le chat d'un événement, visible avant même de rejoindre

Curieux d'un événement mais pas encore décidé ? Tu peux désormais **lire la discussion de l'équipage** avant de t'engager — pour sentir l'ambiance et voir ce qui s'y prépare. Tu restes spectateur (lecture seule), et un bouton **« Rejoindre l'équipage »** est là dès que tu veux entrer dans la conversation.

---

```

- [ ] **Step 2: Build complet (le changelog est bundlé via `?raw`)**

Run: `cd apps/explore-web && pnpm build`
Expected: `✓ built` sans erreur.

- [ ] **Step 3: Lancer toute la suite de tests**

Run: `cd apps/explore-web && pnpm test`
Expected: tous les tests verts (dont les 11 de `expeditionChatAccess`).

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/CHANGELOG.md
git commit -m "chore(changelog): V0.9.75 — chat d'événement visible aux spectateurs"
```

---

## Vérification finale (manuelle, en plus de l'automatisé)

- [ ] Ouvrir un événement `published` **dont on n'est pas membre** → le chat s'affiche, fil lisible, pas d'input, bandeau « 👁️ Tu observes… » + « Rejoindre l'équipage ».
- [ ] Cliquer « Rejoindre l'équipage » sur un événement à validation libre → on rejoint, l'input apparaît.
- [ ] Sur un événement à validation par le chef → le CTA amène à la section « Demande à rejoindre » (scroll desktop / tab Infos mobile).
- [ ] Ouvrir un événement `passed` non-membre → chat lisible, bandeau sans bouton (rejoindre impossible).
- [ ] En tant que membre → input présent, envoi OK (inchangé).
- [ ] Un spectateur ne crée pas d'enregistrement de lecture (le badge non-lu des membres n'est pas affecté par son passage).
- [ ] Mobile : le bandeau spectateur est collé en bas comme l'input, les derniers messages ne sont pas masqués dessous.

## Notes d'exécution

- Pas de migration, pas de changement serveur.
- Respecter TS strict : aucun `any`. Réutiliser les unions de types existantes de `types/expedition.ts` dans le helper.
- Push par lot en fin de session (règle XO) ; déploiement Netlify manuel séparé (`netlify deploy --prod --dir "$PWD/dist" --no-build`).
