---
paths:
  - "apps/hub/**"
---

# Le Hub — back-office

> Conventions propres au back-office. Le Hub pousse vers la boutique : une régression ici se voit en ligne.
> Regroupé le 25/09/2026 depuis la mémoire locale de Claude, pour que ce savoir
> voyage avec le dépôt au lieu de rester sur une seule machine.

## Hub — toujours try/catch/finally + sequential await dans les pages CRUD

Quand je crée/copie une page CRUD dans le hub (Banners, Tutorial, Enigmas, Ads, Constructions, Factions, Divers...), **toujours suivre le pattern canonical** établi par le commit `9e33be4` (fix(hub): try/finally autour des handlers async pour éviter loading infini, 8 mai 2026).

**Why:** Bug récurrent — sur upload/save répété, `setUploading(true)` ou `setSaving(true)` restait coincé si une promesse Supabase rejetait (refresh JWT, network blip, RLS denial). Le bouton se figeait disabled, forçant Uriel à reload la page. Le 10 mai 2026 j'ai répété le bug en copiant `Ads.tsx` (qui a le pattern Promise.all + `.then(() => {})` masquant les erreurs) au lieu de `TutorialManager.tsx` (le canonical fixé). Uriel a dû me le rappeler en plein test prod ("tu l'avais soit disant patché partout ailleurs").

**How to apply:**

1. **`fetchAll` / `fetchData`** : `setLoading(true)` au début → `try { ... if (error) throw error; setX(deep clone); setSavedX(deep clone) } catch { setError } finally { setLoading(false) }`. Toujours **deep clone (`JSON.parse(JSON.stringify(...))`) pour les DEUX states** (current + saved), pas juste un.

2. **`handleSave`** : `setSaving(true)` → `try { for await ... if (error) { setSaveError(); return } } catch { setSaveError(`${e}`) } finally { setSaving(false) }`. **Sequential `for...of` + `await`**, jamais `Promise.all` + `.then(() => {})` qui swallow les erreurs individuelles.

3. **`handleUpload`** : `setUploading(true)` → `try { upload, insert, setBanners } catch { alert(`${e}`) } finally { setUploading(false) }`. Sur erreur insert, **cleanup le fichier orphelin** dans le bucket pour pas l'encrasser.

4. **`handleDelete`** : try/catch même sans state — pour capturer les erreurs au lieu de fail silently.

**Référence canonical** : `apps/hub/src/components/TutorialManager.tsx` (handleSave + fetchSlides). Pas `Ads.tsx` — il a le pattern Promise.all qui marche par chance (les UPDATEs ne rejettent jamais sur `ad_screens` qui a la bonne RLS), mais c'est un piège quand on copie pour une nouvelle table.

**Le hub CLAUDE.md documente déjà la règle** ("try/finally autour des fetch — éviter les Chargement infinis") — ce mémo est juste pour me rappeler le pattern précis avant de coller du `Ads.tsx`.

## feedback_editeurs_vues_internes_pas_panneau

Dans une modale (ex. le Hall de Compagnie), un sous-éditeur (grades, identité d'une Compagnie, etc.) doit **remplacer entièrement le contenu de la modale** = une vraie vue interne plein-écran avec un bouton « ← Retour ». **Jamais** un panneau appendé sous le contenu existant (qui oblige à scroller pour l'atteindre), **ni** une 2ᵉ modale empilée par-dessus.

**Why:** Uriel a qualifié la 1ʳᵉ version de l'éditeur de grades (panneau sous le roster, qu'il fallait scroller tout en bas) de « la pire interface » (26/06). Il veut aussi que l'édition d'identité soit *dans* la modale Compagnie, pas une modale par-dessus.

**How to apply:** modale avec un état `view` (`'roster' | 'grades' | 'identity' | …`) ; chaque vue ≠ roster fait un `return` plein-modale (header retour + corps scrollable + footer collé). Pour embarquer un composant qui se portale d'habitude (ex. `FactionCreateForm`), lui donner un mode `embedded` qui rend le formulaire seul sans overlay/portal. Implémenté ainsi dans `FactionHallModal.tsx`.

## Modales d'explication user-facing — texte minimal, pas de pédagogie sur l'algorithme backend

Le 2026-05-02, j'avais réécrit la modale "Couronnes de Chêne" pour expliquer en détail le cap quotidien à 15, le tirage MD5, le roulement, l'espérance de gain. Uriel a coupé net : *"Tu rentres trop dans les détails. Les joueurs vont se plaindre."* Texte ramené à 1 phrase + 4 lignes simples.

**Why:** un joueur qui découvre une mécanique veut savoir 1) ce qui se passe 2) ce qu'il gagne 3) éventuellement où c'est plafonné. Pas comment c'est implémenté. Trop d'explication = méfiance ("pourquoi ils me parlent d'un algorithme ?") + mur de texte ignoré + sentiment de complexité bureaucratique.

**How to apply:** quand je rédige une modale `InfoModal` ou un texte d'aide :
- 1 phrase de description (ce qui se passe)
- Quelques rows label/valeur (les chiffres clés)
- Pas de mention de "tirage au sort", "algorithme", "cap silencieux", "hash", "espérance", "roulement"
- Pas de "pour les meilleurs joueurs / pour les petits joueurs" — le joueur ne doit pas se classer
- Si je sens le besoin d'expliquer l'algo, c'est probablement que la mécanique elle-même est trop compliquée — alerte

Les détails backend restent dans : commentaires SQL, docs/ specs, mémoire XO, jamais en user-facing.

## Modèle veille — 1 user = 1 mécène = 1 veilleur

**Modèle de veille des lieux (figé Uriel, rappelé 9/05 — déjà donné "un million de fois") :**

- 1 **user** OU 1 **groupe avec nom custom** (s'ils sont plusieurs à veiller — typiquement plantage GPS avec compagnons) = 1 mécène = 1 veilleur. **Mécène = Veilleur**. Synonymes.
- Pas de camp (defense/attack). Pas de notion d'expédition au sens "événement RDV" (qui est un autre concept du 6/05 — événements communautaires).
- **Score d'un user sur un lieu** = total Couronnes investies (toutes sources confondues : plant_flag GPS, invest_crowns, etc.).
- **Veilleur** = le user avec le score le plus élevé sur ce lieu. Point.
- **Bascule** : dès qu'un autre user dépasse le score du veilleur actuel (même de 1), il devient le nouveau veilleur. Instant, pas de seuil, pas de cooldown.
- **Plant_flag GPS — règle uniforme** : à chaque plantage, **tous les autres users** sur ce lieu voient leur score wipé à 0. Le planteur **conserve** son propre score (s'il en avait un, à distance ou local) et reçoit en plus **+50 + 30/compagnon présent** (max 10 compagnons → max +350). Le planteur devient veilleur (puisqu'il a au moins son ancien score + 50, et tous les autres sont à 0). Cette règle est unique : pas de cas "déjà veilleur" vs "pas veilleur" — c'est la même chose, le planteur est toujours protégé, les autres toujours wipés.
- **Verbes UI selon contexte :**
  - Si je suis veilleur courant → un seul bouton : **Renforcer** (Couronnes → mon score).
  - Si je ne suis pas veilleur → deux boutons : **Défier** (Couronnes → mon score) ou **Soutenir** (Couronnes → score du veilleur courant).
  - Mécaniquement : Renforcer ≡ Défier (`beneficiary = self`). Soutenir = `beneficiary = veilleur courant`. Pas de defense/attack côté code.

**Where I went wrong :**

Le 5/05, dans la spec `docs/superpowers/specs/2026-05-05-v07-phase5-la-cour-design.md`, j'ai écrit "expédition" partout alors qu'Uriel avait dit "user". Falsification de la consigne dès la rédaction. J'ai ensuite codé sur la base de ma spec falsifiée — d'où `place_veille.expedition_id`, `invest_crowns(p_target_expedition_id)`, scores agrégés par expé, distinction defense/attack. Et chaque correction d'Uriel ces 3 derniers jours, je l'ai patchée en surface au lieu de remonter au modèle.

Le mot "expédition" dans le code de veille est une scorie de cette falsification. Pas une dette technique neutre — une trace de ma désobéissance.

**Why:** Uriel me l'a redit "un million de fois". Si je remets en doute ce modèle ou je code à côté, ce n'est plus une erreur — c'est une trahison de consigne. Et ça casse le game design (cf. bug Veymont 9/05 : Néphéris top points pas veilleuse, points qui semblent cumulés, etc.).

**How to apply:**
- Toute spec, plan, RPC, table, composant qui touche la veille des lieux doit être rédigé en **user_id**, pas expedition_id.
- Si je vois encore `expedition_id` ou `expedition_members` dans la veille, c'est une dette à éliminer, pas un acquis à respecter.
- Si on touche au code de veille, c'est l'occasion de purger le mot "expédition" du domaine. Le mot "Expédition" n'a qu'un seul sens autorisé dans l'app : **événement RDV** (spec 6/05).
- Avant d'écrire une spec sur la veille / la cour / le mécénat, RELIRE cette mémoire pour ne pas re-falsifier.
- Quand Uriel donne une règle simple ("le top prend la place, point"), ne pas la complexifier en ajoutant expé/camps/seuils/effective scores. La complexité que je rajoute = la falsification.
