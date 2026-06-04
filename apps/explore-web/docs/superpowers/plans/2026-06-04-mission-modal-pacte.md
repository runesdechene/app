# Mission — Le Pacte : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer l'ouverture d'une mission en pacte explicite à sceller : l'ordre se lit en grand, un bouton-pacte doré déverrouille le Salon et les contributions, et la boutique s'invite dans le moment d'engagement.

**Architecture:** Refonte front-only de `MissionModal.tsx` (onglet « Mission ») + son CSS. Aucune migration SQL : `get_mission_state` expose déjà `isParticipant`, `ctaUrl`, `ctaLabel`, `participantsCount`, et la RPC `join_mission` existe. L'auto-join silencieux (`useEffect`) migre vers le clic du pacte. Deux états rendus conditionnellement sur `m.isParticipant` : verrouillé (barre d'action collée) / débloqué (bandeau « engagé » + contributions + soumission).

**Tech Stack:** React 18 + TypeScript strict + Vite. CSS par composant (`MissionModal.css`). Store Zustand `toastStore` pour les erreurs.

---

## Note sur la vérification (pas de runner de test)

Le projet `explore-web` n'a **aucune infrastructure de test** (pas de vitest, pas de `@testing-library`, zéro `*.test.tsx`) — parti pris assumé du codebase. On ne plante pas un harnais juste pour cette refonte (cf. writing-plans : « follow established patterns »). La vérification de chaque tâche = :

1. **`pnpm build`** depuis `apps/explore-web/` (lance `tsc` strict + `vite build`) → doit passer sans erreur TS.
2. **Check visuel** : `pnpm dev` (port 3000), ouvrir une mission publiée depuis le panneau *Quêtes & Expéditions* → carte « Mission », observer le comportement décrit.

Pour le check visuel d'une mission **avec** et **sans** produit, il faut deux missions de test (une avec `cta_url` renseigné, une sans). Si une seule existe en base, vérifier au moins celle disponible et noter l'autre cas comme « à valider manuellement plus tard ».

---

## Structure des fichiers

| Fichier | Responsabilité | Action |
|---------|----------------|--------|
| `src/components/missions/MissionModal.tsx` | Logique + rendu des deux états, handlers du pacte, dialog de confirmation | Modifier |
| `src/components/missions/MissionModal.css` | Styles : `pre-line` du brief, lien boutique discret, barre d'action, bandeau engagé, dialog | Modifier |

Aucun nouveau fichier. Aucun changement SQL, store ou type (`MissionState` est déjà suffisant).

---

## Task 1 : L'ordre respire (brief `pre-line` + lien boutique discret + réordonnancement)

Première tranche purement présentationnelle. L'app continue de fonctionner exactement comme avant (auto-join inclus) — on améliore seulement la lecture de l'ordre. La description passe **avant** le butin et respecte les sauts de ligne ; le lien boutique devient un lien discret pointillé.

**Files:**
- Modify: `src/components/missions/MissionModal.tsx` (bloc rendu onglet Mission, ~l.57-92)
- Modify: `src/components/missions/MissionModal.css` (`.mission-modal-brief` ~l.216-223, `.mission-modal-cta` ~l.225-245)

- [ ] **Step 1 : Réordonner — « L'ordre » avant « Butin » dans le JSX**

Dans `MissionModal.tsx`, l'onglet Mission contient actuellement la section *Butin* (l.72-80) **avant** la section *La mission* (l.82-92). Inverser : déplacer le bloc brief **au-dessus** du butin, et renommer son titre `La mission` → `L'ordre`. Remplacer les deux sections (l.72-92) par :

```tsx
            {m.brief && (
              <section className="mission-modal-section">
                <h3>L'ordre</h3>
                <p className="mission-modal-brief">{m.brief}</p>
                {m.ctaUrl && (
                  <a className="mission-modal-cta" href={m.ctaUrl} target="_blank" rel="noopener noreferrer">
                    🛒 {m.ctaLabel ?? 'Voir le produit'}
                  </a>
                )}
              </section>
            )}

            <section className="mission-modal-section">
              <h3>Butin</h3>
              <div className="mission-modal-rewards">
                <span className="mm-rw">🎖️ Gloire</span>
                <span className="mm-rw">🪙 Couronnes</span>
                {m.rewardHint && <span className="mm-rw gold">{m.rewardHint}</span>}
              </div>
              <p className="mission-modal-butin-note">Récompense fixée à la validation, selon la qualité de ta contribution.</p>
            </section>
```

- [ ] **Step 2 : `pre-line` sur le brief**

Dans `MissionModal.css`, à `.mission-modal-brief` (~l.216), ajouter `white-space: pre-line;` :

```css
.mission-modal-brief {
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  color: #4a3925;
  margin: 0 0 12px;
  white-space: pre-line;
}
```

- [ ] **Step 3 : Lien boutique discret (pointillé) au lieu du bouton bordé**

Dans `MissionModal.css`, remplacer tout le bloc `.mission-modal-cta` (~l.225-245) par un lien discret en ligne :

```css
/* ─────────── Lien boutique discret (sous l'ordre) ─────────── */
.mission-modal-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  background: none;
  color: #8a6f4a;
  border: none;
  border-bottom: 1px dotted #b89a6a;
  padding: 0 0 1px;
  font-family: var(--font-accent);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: none;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.mission-modal-cta:hover {
  color: #6e5435;
  border-bottom-color: #8a7050;
}
```

- [ ] **Step 4 : Build**

Run (depuis `apps/explore-web/`) : `pnpm build`
Expected : `tsc` passe, `vite build` produit `dist/` sans erreur.

- [ ] **Step 5 : Check visuel**

`pnpm dev`, ouvrir une mission. Attendu : la section « L'ordre » apparaît **avant** « Butin », un brief multi-lignes affiche ses sauts de ligne, et le lien boutique (si produit) est un petit lien pointillé sous l'ordre — plus le gros bouton bordé.

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/components/missions/MissionModal.tsx apps/explore-web/src/components/missions/MissionModal.css
git commit -m "refactor(missions): l'ordre avant le butin, brief multi-lignes + lien boutique discret"
```

---

## Task 2 : Le pacte déverrouille (états verrouillé/débloqué + barre d'action + bandeau engagé)

Cœur de la refonte. On retire l'auto-join, on ajoute la machine à états, le bouton-pacte en barre collée, et le bandeau « engagé ». Le dialog de confirmation produit arrive en Task 3 — ici, cliquer le pacte scelle **directement** (comme une mission sans produit), ce qui laisse une app cohérente et testable.

**Files:**
- Modify: `src/components/missions/MissionModal.tsx` (imports, `useEffect`, state, handlers, rendu)
- Modify: `src/components/missions/MissionModal.css` (nouvelles classes)

- [ ] **Step 1 : Retirer l'auto-join du `useEffect`**

Dans `MissionModal.tsx`, remplacer le corps du `useEffect` (l.15-34) par une version qui charge l'état **sans** join automatique :

```tsx
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = await getMissionState(slug)
      if (cancelled) return
      if (state) {
        const [sList, st] = await Promise.all([getMissionSubmissions(slug), getMySubmissionStatus(slug)])
        if (cancelled) return
        setSubs(sList); setMyStatus(st)
      }
      setM(state)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [slug])
```

> `joinMission` reste importé (l.3) — il est désormais appelé par le handler du pacte, plus par le `useEffect`.

- [ ] **Step 2 : Ajouter le state local + les handlers du pacte**

Dans `MissionModal.tsx`, ajouter l'import du toast store en tête de fichier (après les imports existants) :

```tsx
import { useToastStore } from '../../stores/toastStore'
```

Puis, à l'intérieur du composant, après les `useState` existants (après l.13), ajouter :

```tsx
  const [sealing, setSealing] = useState(false)

  async function sealPact(openShop: boolean) {
    if (!m || sealing) return
    if (openShop && m.ctaUrl) {
      window.open(m.ctaUrl, '_blank', 'noopener,noreferrer')
    }
    setSealing(true)
    try {
      await joinMission(m.slug)
      setM({ ...m, isParticipant: true, participantsCount: m.participantsCount + 1 })
    } catch {
      useToastStore.getState().addToast({
        type: 'error',
        message: 'Le pacte n\'a pas pu être scellé. Réessaie.',
        timestamp: Date.now(),
      })
    } finally {
      setSealing(false)
    }
  }
```

> `window.open` est appelé **avant** l'`await` pour rester dans le geste utilisateur (sinon bloqueur de pop-up). En Task 2, `sealPact` est toujours appelé avec `false` (le bouton scelle direct). La branche `openShop=true` servira au dialog de Task 3.

- [ ] **Step 3 : Bandeau « engagé » dans le rendu (état débloqué)**

Dans `MissionModal.tsx`, juste **après** le bloc `.mission-modal-cover` (la `</div>` de fermeture de la cover, ~l.70) et **avant** la section « L'ordre », insérer le bandeau conditionnel :

```tsx
            {m.isParticipant && (
              <div className="mission-modal-engaged">
                <span className="mission-modal-engaged-stamp">✓</span>
                <div className="mission-modal-engaged-text">
                  <strong>Pacte scellé.</strong>
                  <span>Tu es l'un des {m.participantsCount} engagés.</span>
                </div>
              </div>
            )}
```

- [ ] **Step 4 : Verrouiller le contenu social derrière `isParticipant`**

Dans `MissionModal.tsx`, le bloc statut pending + section contributions + bouton « Ajouter ma contribution » (actuellement ~l.94-124, après réordonnancement de Task 1 ils suivent la section Butin) ne doivent s'afficher **que si engagé**. Les envelopper dans `{m.isParticipant && (...)}` :

```tsx
            {m.isParticipant && (
              <>
                {myStatus === 'pending' && (
                  <div className="mission-modal-status">
                    ⏳ Ton offrande est en cours d'examen par l'État-Major.
                  </div>
                )}

                <section className="mission-modal-section">
                  <h3>Les contributions · {subs.length}</h3>
                  <div className="mission-modal-gallery">
                    {subs.map((s) => (
                      <div
                        key={s.submissionId}
                        className="mission-modal-tile"
                        style={{ backgroundImage: `url(${s.imageUrl})` }}
                      >
                        <span className="mission-modal-tile-name">{s.submitterName}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {m.status === 'published' && (
                  <a
                    className="mission-modal-primary"
                    href={`https://hub.runesdechene.com/soumettre-contenu?quete=${m.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    📷 Ajouter ma contribution
                  </a>
                )}
              </>
            )}
```

- [ ] **Step 5 : Onglet Salon verrouillé + barre d'action collée**

Dans `MissionModal.tsx`, rendre l'onglet Salon non cliquable tant que non engagé. Remplacer le bouton Salon (l.53) par :

```tsx
          <button
            className={tab === 'salon' ? 'is-active' : ''}
            onClick={() => m.isParticipant && setTab('salon')}
            disabled={!m.isParticipant}
          >{m.isParticipant ? 'Salon' : '🔒 Salon'}</button>
```

Puis transformer le `{tab === 'mission' ? (...) : (...)}` pour ajouter la barre d'action collée comme sœur de `.mission-modal-main` (toujours dans l'onglet Mission). Remplacer l'ouverture `{tab === 'mission' ? (` ... et la fermeture juste avant `) : (` par une structure fragmentée. Concrètement, envelopper le `<div className="mission-modal-main">…</div>` dans un fragment et y ajouter la barre :

```tsx
        {tab === 'mission' ? (
          <>
            <div className="mission-modal-main">
              {/* … tout le contenu existant de l'onglet Mission … */}
            </div>
            {!m.isParticipant && m.status === 'published' && (
              <div className="mission-modal-pactbar">
                <button className="mission-modal-pact" onClick={() => sealPact(false)} disabled={sealing}>
                  <span className="mission-modal-pact-seal">⚔</span> Je relève ce défi
                </button>
              </div>
            )}
          </>
        ) : (
          <MissionSalon slug={m.slug} intro={m.salonIntro} readOnly={readOnlySalon} />
        )}
```

> La barre est sœur de `.mission-modal-main` dans `.mission-modal` (flex column) : `.mission-modal-main` scrolle (`flex:1 1 auto; overflow-y:auto`), la barre reste épinglée en bas (`flex-shrink:0`).

- [ ] **Step 6 : CSS — barre d'action, bouton-pacte, bandeau engagé**

Dans `MissionModal.css`, ajouter (par exemple après le bloc `.mission-modal-primary`, ~l.318) :

```css
/* ─────────── Barre d'action collée (pacte) ─────────── */
.mission-modal-pactbar {
  flex-shrink: 0;
  padding: 13px 16px;
  background: linear-gradient(0deg, #f5e9d4 72%, rgba(245, 233, 212, 0));
  border-top: 1px solid rgba(184, 154, 106, 0.35);
}
.mission-modal-pact {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, #b9803f, #8a5a26);
  color: #fff7e6;
  border: 1px solid #6e4a22;
  padding: 16px;
  border-radius: 11px;
  font-family: var(--font-accent);
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 5px 0 #5e3c1a, 0 10px 22px rgba(120, 70, 20, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: filter 0.15s, transform 0.05s;
}
.mission-modal-pact:hover { filter: brightness(1.06); }
.mission-modal-pact:active { transform: translateY(2px); box-shadow: 0 3px 0 #5e3c1a, 0 6px 14px rgba(120, 70, 20, 0.45); }
.mission-modal-pact:disabled { opacity: 0.6; cursor: progress; }
.mission-modal-pact-seal {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #e0b46a, #9a6a2a);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #3a2410;
}

/* ─────────── Bandeau « engagé » (remplace le pacte une fois scellé) ─────────── */
.mission-modal-engaged {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 18px 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(94, 112, 68, 0.14);
  border: 1px solid rgba(94, 112, 68, 0.45);
  color: #3d4a2c;
}
.mission-modal-engaged-stamp {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #6e8050, #4a5c32);
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f3f0e2;
  font-size: 14px;
  transform: rotate(-8deg);
}
.mission-modal-engaged-text { display: flex; flex-direction: column; font-family: var(--font-accent); }
.mission-modal-engaged-text strong { font-size: 13px; color: #2a1f10; }
.mission-modal-engaged-text span { font-size: 11px; font-weight: 600; color: #5e7044; }
```

- [ ] **Step 7 : Build**

Run (depuis `apps/explore-web/`) : `pnpm build`
Expected : `tsc` + `vite build` sans erreur.

- [ ] **Step 8 : Check visuel**

`pnpm dev`. Ouvrir une mission publiée **non encore rejointe** (idéalement avec un compte qui n'a jamais ouvert cette mission). Attendu :
- Onglet `🔒 Salon` grisé/non cliquable, pas de contributions, barre dorée « ⚔ Je relève ce défi » collée en bas, visible même en scrollant l'ordre.
- Le compteur d'engagés **n'augmente pas** à la simple ouverture.
- Cliquer « Je relève ce défi » → le bandeau vert « Pacte scellé · tu es l'un des N engagés » apparaît, Salon devient cliquable, contributions + bouton « Ajouter ma contribution » s'affichent, compteur +1.

- [ ] **Step 9 : Commit**

```bash
git add apps/explore-web/src/components/missions/MissionModal.tsx apps/explore-web/src/components/missions/MissionModal.css
git commit -m "feat(missions): le pacte déverrouille la mission (fin de l'auto-join, barre d'action + bandeau engagé)"
```

---

## Task 3 : La confirmation boutique (« As-tu déjà le produit ? »)

Quand la mission a un produit (`ctaUrl`), le clic sur le pacte ouvre d'abord un dialog : « Oui » scelle, « Non » ouvre la boutique **et** scelle. Sans produit, on garde le scellement direct de Task 2.

**Files:**
- Modify: `src/components/missions/MissionModal.tsx` (state `confirming`, handler `handlePactClick`, dialog)
- Modify: `src/components/missions/MissionModal.css` (classes du dialog)

- [ ] **Step 1 : State `confirming` + aiguillage du clic**

Dans `MissionModal.tsx`, ajouter près des autres `useState` :

```tsx
  const [confirming, setConfirming] = useState(false)
```

Et ajouter un handler qui aiguille selon la présence d'un produit :

```tsx
  function handlePactClick() {
    if (!m) return
    if (m.ctaUrl) { setConfirming(true); return }
    void sealPact(false)
  }
```

Puis brancher le bouton-pacte (Task 2 Step 5) sur ce handler — remplacer `onClick={() => sealPact(false)}` par `onClick={handlePactClick}` :

```tsx
                <button className="mission-modal-pact" onClick={handlePactClick} disabled={sealing}>
                  <span className="mission-modal-pact-seal">⚔</span> Je relève ce défi
                </button>
```

- [ ] **Step 2 : Le dialog de confirmation**

Dans `MissionModal.tsx`, à l'intérieur de `.mission-modal` (qui est `position: relative`), juste **avant** sa balise fermante `</div>` (celle qui précède `document.body` dans le `createPortal`), insérer le dialog conditionnel. Au clic « Oui » → `sealPact(false)` ; « Non » → `sealPact(true)`. Les deux ferment le dialog après scellement (via `setConfirming(false)` dans un `.then`, car `sealPact` est async) :

```tsx
        {confirming && m.ctaUrl && (
          <div className="mission-modal-confirm-dim" onClick={() => !sealing && setConfirming(false)}>
            <div className="mission-modal-confirm" onClick={(e) => e.stopPropagation()}>
              <div className="mission-modal-confirm-top">
                <div
                  className="mission-modal-confirm-thumb"
                  style={m.coverImageUrl ? { backgroundImage: `url(${m.coverImageUrl})` } : undefined}
                >
                  {!m.coverImageUrl && <span>{m.emblem}</span>}
                </div>
                <div className="mission-modal-confirm-q">
                  <div className="mission-modal-confirm-lbl">Avant de sceller</div>
                  <div className="mission-modal-confirm-txt">
                    As-tu déjà <strong>{m.ctaLabel ?? 'le matériel'}</strong> pour accomplir ta mission ?
                  </div>
                </div>
              </div>
              <div className="mission-modal-confirm-acts">
                <button
                  className="mission-modal-confirm-yes"
                  disabled={sealing}
                  onClick={() => { void sealPact(false).then(() => setConfirming(false)) }}
                >⚔ Oui — je scelle le pacte</button>
                <button
                  className="mission-modal-confirm-no"
                  disabled={sealing}
                  onClick={() => { void sealPact(true).then(() => setConfirming(false)) }}
                >🛒 Pas encore — montre-moi la boutique</button>
                <div className="mission-modal-confirm-note">Dans les deux cas, te voilà engagé.</div>
              </div>
            </div>
          </div>
        )}
```

> Note popup : `sealPact(true)` appelle `window.open` **avant** son `await`, donc dans le geste du clic « Non » → pas de blocage navigateur.

- [ ] **Step 3 : CSS du dialog**

Dans `MissionModal.css`, ajouter (après les classes de Task 2) :

```css
/* ─────────── Dialog de confirmation (« as-tu le produit ? ») ─────────── */
.mission-modal-confirm-dim {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(30, 20, 10, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.mission-modal-confirm {
  width: 100%;
  max-width: 340px;
  background: #faf2dd;
  border: 1px solid #b89a6a;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 40px rgba(20, 14, 5, 0.5);
}
.mission-modal-confirm-top {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(184, 154, 106, 0.4);
}
.mission-modal-confirm-thumb {
  flex: 0 0 56px;
  width: 56px;
  height: 56px;
  border-radius: 9px;
  background: radial-gradient(120% 90% at 70% 10%, #7a5a2e, #3c2a16 60%, #241710);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
}
.mission-modal-confirm-lbl {
  font-family: var(--font-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #a14a2a;
}
.mission-modal-confirm-txt {
  font-family: var(--font-body);
  font-size: 15px;
  color: #2a1f10;
  line-height: 1.3;
  margin-top: 3px;
}
.mission-modal-confirm-acts {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.mission-modal-confirm-yes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #2a1f10;
  color: #faf2dd;
  border: none;
  padding: 14px;
  border-radius: 9px;
  font-family: var(--font-accent);
  font-weight: 700;
  font-size: 13.5px;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.mission-modal-confirm-yes:hover { background: #000; }
.mission-modal-confirm-no {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: transparent;
  color: #8a5a26;
  border: 1.5px solid rgba(138, 90, 38, 0.55);
  padding: 13px;
  border-radius: 9px;
  font-family: var(--font-accent);
  font-weight: 700;
  font-size: 12.5px;
  letter-spacing: 0.04em;
  cursor: pointer;
}
.mission-modal-confirm-no:hover { background: rgba(138, 90, 38, 0.1); }
.mission-modal-confirm-yes:disabled,
.mission-modal-confirm-no:disabled { opacity: 0.6; cursor: progress; }
.mission-modal-confirm-note {
  text-align: center;
  font-family: var(--font-body);
  font-style: italic;
  font-size: 11px;
  color: #8a7050;
  margin-top: 2px;
}
```

- [ ] **Step 4 : Build**

Run (depuis `apps/explore-web/`) : `pnpm build`
Expected : `tsc` + `vite build` sans erreur.

- [ ] **Step 5 : Check visuel**

`pnpm dev`. Sur une mission **avec produit** non rejointe :
- Cliquer « Je relève ce défi » → le dialog s'ouvre avec la vignette + « As-tu déjà **{ctaLabel}**… ».
- « Oui » → ferme, scelle, état débloqué.
- Rouvrir (autre mission/compte) → « Non » → un onglet boutique s'ouvre **et** la mission passe en état débloqué.
- Sur une mission **sans produit** (`ctaUrl` nul), « Je relève ce défi » scelle direct, sans dialog.

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/components/missions/MissionModal.tsx apps/explore-web/src/components/missions/MissionModal.css
git commit -m "feat(missions): confirmation boutique au scellement du pacte (oui scelle / non ouvre la boutique + scelle)"
```

---

## Auto-revue du plan (couverture spec)

- **Pacte déverrouille / fin auto-join** → Task 2 Steps 1, 4, 5. ✓
- **Direction « Le Dossier », l'ordre en grand** → Task 1 Step 1. ✓
- **`pre-line`** → Task 1 Step 2. ✓
- **Lien boutique discret sous l'ordre** → Task 1 Steps 1, 3. ✓
- **Barre d'action dorée collée** → Task 2 Steps 5, 6. ✓
- **Bandeau « Pacte scellé »** → Task 2 Steps 3, 6. ✓
- **Confirmation produit ; « Non » ouvre boutique ET scelle** → Task 3 (handler `sealPact(true)` ouvre `window.open` puis `joinMission`). ✓
- **Mission sans produit → scelle direct** → Task 3 Step 1 (`handlePactClick`). ✓
- **Front-only, zéro SQL** → aucune tâche ne touche `supabase/`. ✓
- **Cohérence des noms** : `sealPact`, `handlePactClick`, `confirming`, `sealing`, classes `.mission-modal-pact*`, `.mission-modal-engaged*`, `.mission-modal-confirm*` — cohérents entre tâches. ✓

Hors-scope confirmé non implémenté : Markdown, animation du sceau, propagation « engagé » hors modale, renommage. Conforme à la spec.
