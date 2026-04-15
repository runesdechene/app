# Bilan — Audit pré-lancement app Runes de Chêne

**Date :** 2026-04-15
**Branche audit :** `audit-pre-launch-2026-04-15` → merged main
**Plan source :** `docs/superpowers/plans/2026-04-15-audit-pre-lancement.md`

---

## Résumé exécutif

Audit complet exécuté en 5 phases. L'app a été nettoyée (code mort post-V0.5), la Bible Game Design synchronisée, 13 bugs corrigés, 4 vulnérabilités critiques et 3 warnings sécurité fermés. Lancement public déblocable après 1 action restante : SMTP custom (Resend).

---

## Phases exécutées

### Phase 0 — Préparation ✅
- Branche `audit-pre-launch-2026-04-15` créée
- Graphify régénéré (526 nodes, 503 edges après fixes)

### Phase 1 — Cartographie du code mort ✅
- Agent "chasseur de code mort" frontend + backend dispatché
- Code mort supprimé post-V0.5 (Claim/Fortify remplacés par Influence)
- Bannières faction sur carte **préservées** (exception absolue Uriel)
- Migrations cleanup : 082 (unlike_contribution), 083 (cleanup dead RPCs V0.5)

### Phase 2 — Sync Bible ↔ code ✅
- Bible Game Design comparée au code réel
- Divergences documentées, notes vault mises à jour

### Phase 3 — Bugs ✅

**23 findings audités, 10 commits atomiques :**

| Gravité | Qté | Exemples |
|---------|-----|----------|
| 🔴 Bloquant | 4 | FragmentEnigma (useState→useEffect + RPC catch), playerStore localStorage iOS, AddPlaceFlow insert silencieux, usePlayer fire-and-forget |
| 🟠 Important | 5 | useResourceTimers, FactionModal Shopify, ExploreMap (3 RPC) |
| 🟡 Mineur (hub) | 4 | Ads, Photos, PhotoSubmit, ReviewSubmit (catches vides loggés) |

**Helper créé :** `apps/explore-web/src/lib/safeStorage.ts` (wrapper localStorage avec try/catch — crash Safari iOS privé).

**Faux positifs écartés (2) :** InfluenceFrame audio (autoplay policy), territoryWorker union géom (fallback documenté).

**Patterns récurrents documentés dans le vault :**
- `Bugs récurrents/localStorage sans try-catch — crash Safari iOS privé.md`
- `Bugs récurrents/Supabase et fetch fire-and-forget sans log.md`

### Phase 4 — Sécurité Supabase ✅ (partielle)

**4 CRITIQUES fermés (migration 086) :**
- C3 `set_user_faction` : garde `auth.uid()` (escalation)
- C4 `update_my_profile` : garde `auth.uid()` (usurpation profil) + drop 2 overloads morts
- C5 `app_settings` : write restreint `role='admin'` (gameplay settings)
- C6 `users.instagram` : drop policy UPDATE publique (vandalisme)

**3 WARNINGS fermés (migration 087) :**
- W1 `ad_screens`/`ad_tips` : writes `role='admin'` only
- W2 `community-photos` : upload authenticated + extensions image + `file_size_limit 10 MB` + `allowed_mime_types image/*`
- W3 `users` SELECT : restreint authenticated (stop énumération anon)

**Faux positifs écartés (2) :**
- C1 `.env` avec service_role → WARNING (gitignored, setup standard, pas de fuite)
- C2 `claim_place` → RPC morte (absent prod + 0 appel frontend)

**Reporté post-lancement :**
- W4 audit 50+ RPCs `SECURITY DEFINER` (agent dédié requis)
- W5 email audit config dashboard (manuel, 5 min)
- W6 rate-limiting applicatif RPC (gros chantier)

### Phase 4.3 — Infrastructure
- **HTTPS** : OK (Netlify renewal auto)
- **PITR** : écarté ($100/mois, 24h de perte max acceptable au stade actuel)
- **Usage** : page peu lisible, surveillance informelle
- **SMTP Resend** : à configurer ensemble un soir dédié (bloquant lancement public — 30 signups/h par défaut trop bas)
- **Rate limits Auth Supabase** : à augmenter après SMTP custom OK

### Phase 5 — Clôture ✅
- Ce document
- `log.md` mis à jour
- `Backlog - Infrastructure.md` mis à jour (SMTP, PITR décision, W4-W6 reportés)

---

## Commits notables sur main

```
dca816d merge: Phase 4 warnings — migration 087 (W1/W2/W3 policies)
ecf2ba4 merge: Phase 4 audit sécurité — migration 086 (auth.uid checks + policies)
ff57a04 merge: Phase 3 audit — fix 10 bugs pré-lancement (error handling + safeStorage)
6bcadcf merge: audit pre-lancement — Phase 1 (code+backend cleanup) + Phase 2 (Bible sync)
```

---

## Reste avant lancement public

**🔥 1 action bloquante :** SMTP Resend custom (~15 min un soir).

Tout le reste est nettoyé, sécurisé, documenté.
