# Mécénat d'un challenger (soutenir un attaquant) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton « Soutenir » sur chaque challenger de la liste des mécènes (fiche de lieu → La Cour), permettant de créditer le score d'un attaquant existant sans le rejoindre.

**Architecture:** La Cour est user-centric (mig 152/156). On ajoute un paramètre optionnel `p_beneficiary_user_id` à `invest_crowns` pour créditer un challenger désigné, et un champ `challengers` à `get_place_court_state` pour exposer les cibles soutenables. Côté front, un bouton par ligne challenger ouvre la modale d'investissement existante en mode soutien.

**Tech Stack:** Supabase (PostgreSQL plpgsql RPC) · React 18 + Vite + TypeScript strict · Zustand. **Aucun test runner** dans ce repo — la vérification automatique est `pnpm build` (tsc strict + vite) ; le reste est vérifié par requêtes SQL d'assertion + scénario 2 comptes.

**Spec de référence :** `docs/superpowers/specs/2026-05-24-mecenat-challenger-design.md`

**Baselines vérifiées (plus haut numéro de migration) :** `invest_crowns` → mig **164** ; `get_place_court_state` → mig **156**. Prochaine migration libre : **173** (172 = dernière actuelle).

---

## Conventions de ce repo (lire avant de commencer)

- **Pas de `any`, pas de `@ts-ignore`, pas de `as unknown as`** (TS strict). Pas de `console.log`.
- **RPC redéfinie = copier-coller la baseline ENTIÈRE puis modifier uniquement le diff** (`docs/db/gotchas.md` § "Lire avant de réécrire"). Ne jamais retaper de mémoire.
- **Appliquer la migration soi-même** : `npx supabase db push` (CLAUDE.md : npx réservé à supabase). Puis vérifier.
- **Commits fréquents** (un par tâche qui build). **Push par lots** : en fin de session, pas à chaque commit (`xo-discipline` E4).
- **Déploiement Netlify manuel**, jamais auto — seulement sur feu vert d'Uriel.

---

## Task 1 : Migration 173 — backend (invest_crowns + get_place_court_state)

**Files:**
- Create: `supabase/migrations/173_court_support_challenger.sql`
- Baseline source `invest_crowns` : `supabase/migrations/164_actor_id_in_notif_data.sql:22-286`
- Baseline source `get_place_court_state` : `supabase/migrations/156_top_patrons_desagrege_par_user.sql:26-271`

- [ ] **Step 1 : Créer le fichier et coller les deux baselines verbatim**

Créer `supabase/migrations/173_court_support_challenger.sql`. Structure :

```sql
-- 173_court_support_challenger.sql
-- WHY : mécénat d'un challenger (Uriel 24/05). Aujourd'hui invest_crowns ne sait
-- créditer que le veilleur (soutien) ou le caller (attaque solo). On ajoute la
-- capacité de créditer un CHALLENGER désigné (p_beneficiary_user_id), pour
-- pouvoir financer une offensive existante au lieu de lancer la sienne. Modèle
-- faiseur-de-roi : le challenger soutenu monte, et c'est LUI qui bascule.
-- get_place_court_state expose une liste `challengers` (cibles soutenables).
--
-- Baselines (plus haut numéro) : invest_crowns mig 164, get_place_court_state mig 156.

BEGIN;

-- 1. invest_crowns  (copier-coller VERBATIM le corps de la mig 164, puis appliquer
--    les diffs des steps 2-4)

-- 2. get_place_court_state (copier-coller VERBATIM le corps de la mig 156, puis
--    appliquer le diff du step 5)

COMMIT;
```

Coller le corps complet de `invest_crowns` (mig 164, lignes 22-286) et de `get_place_court_state` (mig 156, lignes 26-271) à l'emplacement des commentaires `-- 1.` et `-- 2.`, **y compris** leurs `GRANT EXECUTE` respectifs. Ne rien modifier à ce stade.

- [ ] **Step 2 : `invest_crowns` — modifier la signature (ajout du paramètre)**

Remplacer la ligne de signature copiée :

```sql
CREATE OR REPLACE FUNCTION public.invest_crowns(p_user_id text, p_place_id text, p_target_expedition_id uuid, p_amount integer)
```

par :

```sql
CREATE OR REPLACE FUNCTION public.invest_crowns(p_user_id text, p_place_id text, p_target_expedition_id uuid, p_amount integer, p_beneficiary_user_id text DEFAULT NULL)
```

Et mettre à jour le `GRANT` correspondant en bas de la fonction :

```sql
GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer, text)
  TO authenticated, service_role;
```

> Le `DEFAULT NULL` garde l'appel actuel du front (`invest_crowns(p_user_id, p_place_id, p_target_expedition_id, p_amount)`) valide. **Ne pas** `DROP` l'ancienne signature à 4 args dans cette migration : une `CREATE OR REPLACE` avec un nombre d'args différent crée une **surcharge** distincte. Ajouter en fin de migration (avant `COMMIT`) :
>
> ```sql
> -- Retire l'ancienne surcharge à 4 args (remplacée par la version à 5 args).
> DROP FUNCTION IF EXISTS public.invest_crowns(text, text, uuid, integer);
> ```

- [ ] **Step 3 : `invest_crowns` — remplacer le bloc de détermination camp/bénéficiaire**

Dans le corps copié, repérer ce bloc (mig 164 lignes 74-82) :

```sql
  v_target_is_veilleur := (NOT v_was_vacant AND p_target_expedition_id = v_current_veilleur_exp);

  IF v_target_is_veilleur THEN
    v_side := 'defense';
    v_beneficiary := v_current_veilleur_user;
  ELSE
    v_side := 'attack';
    v_beneficiary := p_user_id;
  END IF;
```

Le remplacer par :

```sql
  v_target_is_veilleur := (NOT v_was_vacant AND p_target_expedition_id = v_current_veilleur_exp);

  -- V173 : bénéficiaire explicite (mécénat d'un challenger). Prime sur la
  -- déduction par expédition. NULL = comportement legacy.
  IF p_beneficiary_user_id IS NOT NULL AND p_beneficiary_user_id IS DISTINCT FROM p_user_id THEN
    IF NOT v_was_vacant AND p_beneficiary_user_id = v_current_veilleur_user THEN
      v_side := 'defense';
      v_beneficiary := v_current_veilleur_user;
    ELSE
      -- Le bénéficiaire doit être un challenger réel (score > 0, ≠ veilleur).
      IF (NOT v_was_vacant AND p_beneficiary_user_id = v_current_veilleur_user)
         OR COALESCE(public._user_place_score(p_beneficiary_user_id, p_place_id), 0) <= 0 THEN
        RETURN json_build_object('error', 'not_a_challenger');
      END IF;
      v_side := 'attack';
      v_beneficiary := p_beneficiary_user_id;
    END IF;
  ELSIF v_target_is_veilleur THEN
    v_side := 'defense';
    v_beneficiary := v_current_veilleur_user;
  ELSE
    v_side := 'attack';
    v_beneficiary := p_user_id;
  END IF;
```

> Le front passe en `p_target_expedition_id` l'expé challenger du bénéficiaire (exposée par `get_place_court_state.challengers[].expeditionId`). Le check `v_target_exists` existant (lignes 65-72) la valide, et la bascule (lignes 104-124) pose `place_veille.expedition_id = p_target_expedition_id` correctement. Aucune dérivation interne nécessaire.

- [ ] **Step 4 : `invest_crowns` — notifier le challenger soutenu**

Dans le corps copié, repérer la fin du bloc `ELSIF v_side = 'attack' AND NOT v_was_vacant THEN` (mig 164), juste après le bloc `place_court_high_threat` qui se termine ligne 227 (`END IF;` du seuil 50%), et **avant** le `ELSIF v_side = 'defense'` (ligne 228). Insérer à cet endroit :

```sql
    -- V173 : mécénat d'un challenger → notif perso au challenger soutenu.
    -- (Pas émise si la bascule a eu lieu : le challenger reçoit alors place_taken_remote_self.)
    IF v_beneficiary IS DISTINCT FROM p_user_id THEN
      v_notif_data := jsonb_build_object(
        'placeId',         p_place_id,
        'placeTitle',      v_place_title,
        'actorId',         p_user_id,
        'actorName',       v_actor_name,
        'amount',          p_amount,
        'targetSide',      'attack',
        'beneficiaryName', (SELECT COALESCE(display_name, first_name, 'le challenger')
                            FROM public.users WHERE id = v_beneficiary)
      );
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_support', p_user_id, p_place_id, v_notif_data);
      PERFORM public.notify(v_beneficiary, 'place_court_support', v_notif_data);
    END IF;
```

> Le veilleur garde ses notifs `place_court_attack` / `place_court_high_threat` (déjà émises plus haut dans la même branche, logique sur `v_new_score` = score du bénéficiaire challenger). On réutilise le type `place_court_support` avec `targetSide='attack'` pour distinguer le wording côté front (Task 3).

- [ ] **Step 5 : `get_place_court_state` — ajouter le champ `challengers`**

Dans le corps copié de la mig 156 :

5a. Déclarer la variable. Dans le bloc `DECLARE` (après `v_favor_points integer;`, mig 156 ligne 52), ajouter :

```sql
  v_challengers      jsonb;
```

5b. Calculer `challengers`. Juste après le bloc `topPatrons` (mig 156, après la ligne 106 `LEFT JOIN public.factions f ON f.id = u.faction_id;`), insérer :

```sql
  -- V173 : challengers user-centric = cibles soutenables. Groupé par bénéficiaire,
  -- non-veilleur, score > 0. expeditionId = expé challenger du user sur ce lieu
  -- (passée telle quelle par le front à invest_crowns).
  WITH chal AS (
    SELECT pca.beneficiary_user_id AS user_id, SUM(pca.amount)::integer AS score
    FROM public.place_court_action pca
    WHERE pca.place_id = p_place_id
      AND (v_veilleur_user IS NULL OR pca.beneficiary_user_id IS DISTINCT FROM v_veilleur_user)
    GROUP BY pca.beneficiary_user_id
    HAVING SUM(pca.amount) > 0
    ORDER BY SUM(pca.amount) DESC
    LIMIT 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId',         c.user_id,
    'displayName',    COALESCE(u.display_name, u.first_name, u.id),
    'avatarUrl',      u.avatar_url,
    'score',          c.score,
    'factionColor',   f.color,
    'factionPattern', f.pattern,
    'expeditionId',   (
      SELECT e.id FROM public.expeditions e
      JOIN public.expedition_members em ON em.expedition_id = e.id
      WHERE em.user_id = c.user_id AND e.place_id = p_place_id
        AND (v_veilleur_exp IS NULL OR e.id != v_veilleur_exp)
      LIMIT 1
    )
  ) ORDER BY c.score DESC), '[]'::jsonb)
  INTO v_challengers
  FROM chal c
  JOIN public.users u ON u.id = c.user_id
  LEFT JOIN public.factions f ON f.id = u.faction_id;
```

5c. Ajouter `'challengers', v_challengers` dans **les DEUX** `json_build_object` de retour : le bloc `IF p_user_id IS NULL` (mig 156 lignes 215-228) et le retour final (lignes 248-266). Ajouter la paire juste après la ligne `'topPatrons', v_top_patrons,` dans chacun :

```sql
      'topPatrons',         v_top_patrons,
      'challengers',        v_challengers,
```

- [ ] **Step 6 : Appliquer la migration**

Run :
```bash
cd "C:/Users/uriel/desktop/DEVs/app (Runes de Chêne)" && npx supabase db push
```
Expected : migration `173_court_support_challenger.sql` appliquée sans erreur. Si erreur de syntaxe → relire les hunks (accolades plpgsql, `END IF;`).

- [ ] **Step 7 : Vérifier en SQL (assertions manuelles)**

Sur un lieu de test ayant un veilleur V et un challenger C (score C > 0), depuis le SQL editor Supabase. Récupérer un `place_id` veillé et les ids :
```sql
SELECT place_id, veilleur_user_id FROM place_veille WHERE veilleur_user_id IS NOT NULL LIMIT 1;
SELECT beneficiary_user_id, SUM(amount) FROM place_court_action WHERE place_id = '<PLACE>' GROUP BY 1;
```
Vérifier que `get_place_court_state` expose bien `challengers` :
```sql
SELECT (get_place_court_state('<PLACE>', '<ANY_USER>')->'challengers');
-- Expected : tableau JSON [{userId, displayName, score, expeditionId, ...}], score décroissant.
```
Vérifier le refus si bénéficiaire non-challenger :
```sql
SELECT invest_crowns('<CALLER>', '<PLACE>', '<SOME_EXP>', 1, '<USER_SANS_SCORE>');
-- Expected : {"error":"not_a_challenger"}
```

- [ ] **Step 8 : Commit**

```bash
git add supabase/migrations/173_court_support_challenger.sql
git commit -m "feat(court): invest_crowns p_beneficiary_user_id + challengers dans court_state (mecenat challenger)"
```
> Le post-commit hook lance `graphify-sql.py` (commit touchant `supabase/migrations/`).

---

## Task 2 : Types front (`types/court.ts`)

**Files:**
- Modify: `apps/explore-web/src/types/court.ts`

- [ ] **Step 1 : Ajouter l'interface `Challenger` et le champ `challengers`**

Après l'interface `Patron` (ligne 48), ajouter :

```ts
export interface Challenger {
  userId: string
  displayName: string
  avatarUrl: string | null
  score: number
  factionColor: string | null
  factionPattern: string | null
  /** Expé challenger du user sur ce lieu — passée telle quelle à invest_crowns.
   *  Null seulement dans un cas anormal (challenger sans expé) → bouton désactivé. */
  expeditionId: string | null
}
```

Dans l'interface `PlaceCourtState`, ajouter après `topPatrons: Patron[]` :

```ts
  challengers: Challenger[]
```

- [ ] **Step 2 : Vérifier la compilation**

Run : `cd apps/explore-web && pnpm build`
Expected : build OK (le champ `challengers` n'étant pas encore consommé, aucune erreur).

- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/types/court.ts
git commit -m "feat(court): types Challenger + challengers dans PlaceCourtState"
```

---

## Task 3 : Wording du toast (`courtToastMessages.ts`)

**Files:**
- Modify: `apps/explore-web/src/lib/courtToastMessages.ts`

- [ ] **Step 1 : Étendre l'interface `data`**

Dans `CourtActivityRow.data` (lignes 9-21), ajouter deux champs optionnels :

```ts
    threatsCleared?: number
    targetSide?: string
    beneficiaryName?: string
```

- [ ] **Step 2 : Brancher le wording `place_court_support` selon `targetSide`**

Remplacer tout le `case 'place_court_support': { ... }` (lignes 66-81) par :

```ts
    case 'place_court_support': {
      const amt = row.data?.amount ?? 0
      const suffix = amt > 0 ? ` (+${amt} 🪙)` : ''
      const isAttack = row.data?.targetSide === 'attack'
      if (isAttack) {
        const benef = row.data?.beneficiaryName ?? 'un attaquant'
        if (isSelf) {
          return {
            message: `🤝 Vous soutenez l'offensive de ${benef} sur ${placeTitle}${suffix}`,
            highlights: [benef, placeTitle],
            hasActorInHighlights: false,
          }
        }
        return {
          message: `🤝 ${actorName} soutient l'offensive de ${benef} sur ${placeTitle}${suffix}`,
          highlights: [actorName, placeTitle],
          hasActorInHighlights: true,
        }
      }
      if (isSelf) {
        return {
          message: `🤝 Vous avez soutenu le veilleur de ${placeTitle}${suffix}`,
          highlights: [placeTitle],
          hasActorInHighlights: false,
        }
      }
      return {
        message: `🤝 ${actorName} soutient le veilleur de ${placeTitle}${suffix}`,
        highlights: [actorName, placeTitle],
        hasActorInHighlights: true,
      }
    }
```

> `NotificationPanel.tsx` rend déjà `place_court_support` en « X est venu à votre secours sur {lieu} » — wording neutre, correct pour un challenger destinataire. **Aucune modif NotificationPanel.**

- [ ] **Step 3 : Vérifier la compilation**

Run : `cd apps/explore-web && pnpm build`
Expected : build OK.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/lib/courtToastMessages.ts
git commit -m "feat(court): toast distinct pour le soutien a un challenger (targetSide attack)"
```

---

## Task 4 : Modale d'investissement (`InvestCrownsModal.tsx`)

**Files:**
- Modify: `apps/explore-web/src/components/places/actions/InvestCrownsModal.tsx`

- [ ] **Step 1 : Ajouter la prop `beneficiaryUserId` et la transmettre à la RPC**

Dans `InvestCrownsModalProps` (lignes 8-21), ajouter après `side: CourtSide` :

```ts
  /** V173 — si fourni, l'investissement crédite ce challenger (mécénat d'attaque)
   *  au lieu du caller. Transmis tel quel à invest_crowns. */
  beneficiaryUserId?: string
```

Dans la déstructuration `const { ... } = props` (ligne 24), ajouter `beneficiaryUserId` :

```ts
  const { placeId, placeTitle, expeditionId, expeditionName, side, scoreToBeat, currentScore, balance, beneficiaryUserId, onClose, onSuccess } = props
```

Dans `handleConfirm`, l'appel RPC (lignes 39-44), ajouter le paramètre :

```ts
    const { data, error: rpcError } = await supabase.rpc('invest_crowns', {
      p_user_id: userId,
      p_place_id: placeId,
      p_target_expedition_id: expeditionId,
      p_amount: amount,
      p_beneficiary_user_id: beneficiaryUserId ?? null,
    })
```

- [ ] **Step 2 : Adapter le titre quand c'est un soutien à un challenger**

Remplacer le `<h3>` (lignes 64-66) :

```tsx
        <h3 className="invest-title">
          {beneficiaryUserId ? 'Soutenir' : (side === 'defense' ? 'Soutenir' : 'Défier')}
        </h3>
```

- [ ] **Step 3 : Vérifier la compilation**

Run : `cd apps/explore-web && pnpm build`
Expected : build OK.

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/components/places/actions/InvestCrownsModal.tsx
git commit -m "feat(court): InvestCrownsModal accepte beneficiaryUserId (mecenat challenger)"
```

---

## Task 5 : Bouton « Soutenir » dans la liste (`PatronsList.tsx`)

**Files:**
- Modify: `apps/explore-web/src/components/places/details/PatronsList.tsx`
- Modify: `apps/explore-web/src/components/places/details/PatronsList.css`

- [ ] **Step 1 : Étendre les props et baser la section Challengers sur `challengers`**

Importer le type (ligne 4) :

```ts
import type { Patron, Challenger } from '../../../types/court'
```

Ajouter à `PatronsListProps` (lignes 6-13) :

```ts
  /** V173 — liste user-centric des attaquants soutenables (cibles à dépasser). */
  challengers?: Challenger[]
  /** V173 — clic « Soutenir » sur un challenger. */
  onSupportChallenger?: (c: Challenger) => void
```

Dans la signature de `PatronsList` (ligne 61), ajouter les deux :

```ts
export function PatronsList({ patrons, currentUserId, veilleurUserId, scoreVeilleur, challengers = [], onSupportChallenger }: PatronsListProps) {
```

Supprimer la dérivation `challengers` issue de `patrons` (lignes 74-76) :

```ts
  const challengers = patrons
    .filter(p => p.userId !== veilleurUserId && p.attackTotal > 0)
    .sort((a, b) => b.attackTotal - a.attackTotal)
```

> `mecenePatron` et `supporters` (lignes 70-73) restent inchangés : ils alimentent « Mécène Principal » + « Soutiens » depuis `topPatrons` (vue réputation). `challengers` (vue cibles) vient désormais de la prop.

- [ ] **Step 2 : Remplacer le rendu de la section Challengers**

Remplacer tout le bloc `{challengers.length > 0 && ( ... )}` (lignes 153-167) par :

```tsx
      {challengers.length > 0 && (
        <>
          <div className="patrons-section-label patrons-section-challengers">⚔ Challengers</div>
          {challengers.map((c, i) => (
            <div
              key={c.userId}
              className={`patron-row patron-row-challenger${currentUserId === c.userId ? ' is-you' : ''}`}
            >
              <span className="patron-rank">{`#${i + 1}`}</span>
              <button
                type="button"
                className="patron-name"
                onClick={() => openProfile(c.userId)}
                title={`Voir le profil de ${c.displayName}`}
              >
                {c.displayName}
                {c.factionPattern && c.factionColor && (
                  <span
                    className="patron-faction-icon"
                    style={{
                      backgroundColor: c.factionColor,
                      WebkitMaskImage: `url(${c.factionPattern})`,
                      maskImage: `url(${c.factionPattern})`,
                    }}
                    aria-hidden
                  />
                )}
                {currentUserId === c.userId && <span className="patron-you">(vous)</span>}
              </button>
              <span className="patron-breakdown">
                <span className="patron-side patron-side-influence" title="Score d'attaque">⚔ {c.score}</span>
              </span>
              {onSupportChallenger && currentUserId !== c.userId && c.expeditionId && (
                <button
                  type="button"
                  className="patron-support-btn"
                  onClick={() => onSupportChallenger(c)}
                  title={`Soutenir ${c.displayName}`}
                >
                  🪙 Soutenir
                </button>
              )}
            </div>
          ))}
        </>
      )}
```

> Le bouton est masqué pour soi-même et si `expeditionId` est null (cas anormal). On ne peut pas soutenir sa propre attaque via ce bouton (on a déjà « Influencer »).

- [ ] **Step 3 : Vérifier que `PatronRow` n'est plus utilisé que par les soutiens**

`PatronRow` (lignes 24-59) reste utilisé par la section Soutiens (side="defense"). Ne pas le supprimer. Vérifier qu'aucun appel `PatronRow` avec `side="attack"` ne subsiste (la section challenger n'utilise plus `PatronRow`).

- [ ] **Step 4 : Style du bouton**

Dans `PatronsList.css`, ajouter :

```css
.patron-support-btn {
  margin-left: 8px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid rgba(212, 175, 55, 0.5);
  border-radius: 6px;
  background: rgba(212, 175, 55, 0.12);
  color: #d4af37;
  cursor: pointer;
}
.patron-support-btn:hover {
  background: rgba(212, 175, 55, 0.22);
}
.patron-row-challenger {
  display: flex;
  align-items: center;
}
```

- [ ] **Step 5 : Vérifier la compilation**

Run : `cd apps/explore-web && pnpm build`
Expected : build OK. (Erreur attendue tant que Task 6 n'a pas câblé les nouvelles props depuis `PlaceCourtView` ? Non — les props sont optionnelles, donc `PlaceCourtView` compile encore. Ce build doit passer.)

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/components/places/details/PatronsList.tsx apps/explore-web/src/components/places/details/PatronsList.css
git commit -m "feat(court): bouton Soutenir par challenger dans PatronsList"
```

---

## Task 6 : Câblage (`PlaceCourtView.tsx`)

**Files:**
- Modify: `apps/explore-web/src/components/places/details/PlaceCourtView.tsx`

- [ ] **Step 1 : Importer la modale et le type**

Ligne 7 (après l'import `PatronsList`), ajouter :

```ts
import { InvestCrownsModal } from '../actions/InvestCrownsModal'
```

Dans l'import de types (ligne 9), ajouter `Challenger` :

```ts
import type { PlaceCourtState, CourtSide, CreateChallengerExpeditionResult, InvestCrownsResult, CourtStatus, Challenger } from '../../../types/court'
```

- [ ] **Step 2 : State pour la cible de soutien**

Après les autres `useState` (vers ligne 56, après `const [bursts, setBursts] = ...`), ajouter :

```ts
  const [supportTarget, setSupportTarget] = useState<Challenger | null>(null)
```

- [ ] **Step 3 : Passer les nouvelles props à `PatronsList`**

Remplacer le bloc `<PatronsList ... />` (lignes 354-359) par :

```tsx
      <PatronsList
        patrons={topPatrons}
        currentUserId={userId ?? undefined}
        veilleurUserId={veilleur?.leaderUserId ?? null}
        scoreVeilleur={optimisticVeilleurScore}
        challengers={state.challengers}
        onSupportChallenger={setSupportTarget}
      />

      {supportTarget && supportTarget.expeditionId && (
        <InvestCrownsModal
          placeId={placeId}
          placeTitle={_placeTitle}
          expeditionId={supportTarget.expeditionId}
          expeditionName={supportTarget.displayName}
          side="attack"
          scoreToBeat={scoreVeilleur}
          currentScore={supportTarget.score}
          balance={balance}
          beneficiaryUserId={supportTarget.userId}
          onClose={() => setSupportTarget(null)}
          onSuccess={() => {
            setSupportTarget(null)
            if (userId) void refreshCrowns(userId)
            void fetchState()
          }}
        />
      )}
```

> `state.challengers` est garanti présent (champ ajouté à `PlaceCourtState`, type non-optionnel). `_placeTitle` est le prop déjà reçu (renommé car inutilisé jusqu'ici). Le `&& supportTarget.expeditionId` narrow le type `string | null` → `string` sans `!`.

- [ ] **Step 4 : Vérifier la compilation**

Run : `cd apps/explore-web && pnpm build`
Expected : build OK. Si TS se plaint que `_placeTitle` est inutilisé ailleurs, c'est résolu (il est maintenant consommé).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/places/details/PlaceCourtView.tsx
git commit -m "feat(court): cablage modale de soutien challenger dans PlaceCourtView"
```

---

## Task 7 : Vérification bout-en-bout + doc + livraison

**Files:**
- Modify (si besoin) : `apps/explore-web/CLAUDE.md`

- [ ] **Step 1 : Build complet final**

Run : `cd apps/explore-web && pnpm build`
Expected : `tsc && vite build` OK, zéro erreur, zéro `any`, zéro `console.log` ajouté.

- [ ] **Step 2 : Scénario 2-3 comptes (manuel, sur prod/staging après deploy ou en local)**

Comptes : A (veilleur), B (challenger), C (tiers).
1. B ouvre la fiche du lieu de A → « Influencer » plusieurs fois → B devient un challenger (score B = X, visible dans la liste).
2. C ouvre la fiche → déplie « Mécènes du lieu » → section « ⚔ Challengers » montre B avec son score + bouton « 🪙 Soutenir ».
3. C clique « Soutenir » → modale « Soutenir B », slider, preview « score X → X+N, à battre : score veilleur ». Confirme.
   - Attendu : score de B monte ; A reçoit toast/notif `place_court_attack` (puis `high_threat` au seuil) ; B reçoit notif « C est venu à votre secours » ; feed live affiche « C soutient l'offensive de B ».
4. C continue jusqu'à dépasser A → **bascule** : c'est **B** qui devient veilleur (vérifier `place_veille.veilleur_user_id = B`), pas C. C reste visible comme contributeur.
5. A re-plante GPS sur le lieu → les scores tiers sont wipés, A redevient veilleur (vérifier que `plant_flag` n'a pas régressé).
6. Cas refus : tenter de soutenir un user sans score (via DevTools/console RPC) → `{"error":"not_a_challenger"}`.

- [ ] **Step 3 : Mettre à jour le CLAUDE.md de l'app si structure changée**

Aucun nouveau sous-dossier/store/helper majeur n'est créé (on étend l'existant). Ajouter une ligne de version dans `apps/explore-web/CLAUDE.md` décrivant la feature (ex. `V0.8.x : mécénat d'un challenger — bouton Soutenir par attaquant dans PatronsList, invest_crowns p_beneficiary_user_id, champ challengers`). Commit :

```bash
git add apps/explore-web/CLAUDE.md
git commit -m "docs(explore-web): note mecenat challenger (V0.8.x)"
```

- [ ] **Step 4 : Bump version + push du lot (fin de session)**

Bumper `APP_VERSION` (patch) si un `version.ts` existe, puis push du lot complet :

```bash
git push
```

- [ ] **Step 5 : Déploiement Netlify — SEULEMENT sur feu vert d'Uriel**

```bash
cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build
```
(Build préalable requis : `pnpm build` produit `dist/`.) Ne pas déployer sans validation explicite (Netlify manuel, jamais auto).

---

## Self-review (couverture spec)

- D1 mécénat libre → Task 1 step 3 (beneficiary = challenger sans adhésion) ✓
- D2 agnostique faction → aucune contrainte de faction ajoutée (validation = score>0 uniquement) ✓
- D3 faiseur de roi → bascule clé sur `v_beneficiary` (baseline 164 inchangée sur ce point) ✓
- D4 bouton dans la liste + Influencer inchangé → Task 5/6, « Influencer » non touché ✓
- D5 challengers existants uniquement → check `_user_place_score > 0` (Task 1 step 3) + liste `challengers` filtrée score>0 (step 5) ✓
- Notif au challenger (spec §5.1.4) → Task 1 step 4 + Task 3 ✓
- Cas limites spec §7 → `not_a_challenger`, narrow expeditionId, auto-soutien autorisé, bascule pendant le clic ✓
- Hors scope §8 → pas de bouton sur soutiens/veilleur via liste, pas de titre, pas de remboursement ✓
