# Partage de lieux — Design

> Spec de la feature **Bouton Partager** sur les fiches de lieu (app + SEO Page).
> Date : 2026-04-21 · Statut : validé par Uriel · Prochaine étape : plan d'implémentation.

---

## Contexte et motivation

L'app Runes de Chêne publie depuis avril 2026 une page SEO immersive pour chaque lieu (`carte.runesdechene.com/lieu/[slug]`), générée nightly par un pipeline Node.js. Ces pages sont aujourd'hui **orphelines côté distribution** : aucun moyen pour un utilisateur de partager un lieu depuis l'app vers ses contacts, ni depuis la SEO Page elle-même.

**Enjeu stratégique** : fermer la boucle d'acquisition virale. Un utilisateur partage un lieu → un visiteur atterrit sur la SEO Page → l'intérêt est capté → téléchargement de l'app → email capturé → boucle communauté.

**Préoccupation sous-jacente** (Uriel) : la perception de l'app comme "app de voyage" plutôt que "jeu de patrimoine". Le texte pré-rempli du partage doit contribuer à communiquer l'aura Runes de Chêne (mystère, exploration, France oubliée) plutôt que sonner marketing ou factuel.

---

## Scope

**IN**
- Bouton Partager dans le `PlacePanel` de l'app (explore-web), visible pour tous (guest + connecté)
- Bouton Partager sur la SEO Page, dans la nav transparente du hero
- Mécanique `navigator.share` natif mobile, fallback copier-coller sur desktop
- Texte pré-rempli éditable depuis le hub (stocké dans `app_settings`)
- Placeholder `{name}` remplacé côté client par le nom du lieu
- Toast de confirmation "Lien copié ✓" sur le fallback desktop

**OUT (cette itération)**
- Variations contextuelles selon l'état du joueur (revendiqué, découvert, etc.)
- Tracking analytics des partages
- Trigger manuel de rebuild SEO depuis le hub — latence ~24h acceptée
- Affichage de la faction dominante sur la SEO Page (reporté, "trop tôt")
- Images Open Graph dynamiques

---

## Décisions prises

| Décision | Retenu | Alternatives écartées | Raison |
|---|---|---|---|
| Mécanique share | `navigator.share` + fallback clipboard | URL nue / variations contextuelles | Standard mobile 2026, meilleur ratio effort/impact |
| Visibilité | Tout le monde (guest + connecté) | Connecté seulement / guest grisé | But = viralité, friction zéro |
| Placement app | Icône header PlacePanel (P1) | Bouton texte zone d'actions | Pattern iOS/Android standard |
| Placement SEO | Icône nav transparente (S1) | Overlay hero / fin de page | Visible dès arrivée, ne casse pas le hero cinématique |
| Ton du texte | T2 narratif immersif | T1 sobre / T3 ludique explicite | Ligne éditoriale bonapartiste, garde l'aura patrimoniale |
| Source du texte | `app_settings` DB éditable via hub | Constants hardcodées | Éditable live sans push de code |
| Factorisation | Duplication logique + constante DB partagée | Package `packages/share/` dédié | YAGNI — logique triviale, éviter over-engineering |

---

## Architecture

```
                     app_settings (Supabase)
                     key   = share_text_template
                     value = "Un trésor oublié t'attend sur Runes de Chêne. 
                              Viens explorer {name}."
                          │
                          │ SELECT (RLS : lecture publique, écriture authenticated)
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        Hub Settings   App runtime  SEO build
        (edit + save)  (Zustand     (inject HTML
                        cache)       dans templates)
```

**Infrastructure existante réutilisée** :
- Table `app_settings` (key/value) existe depuis la migration `001_baseline.sql` (ligne 5107). RLS déjà propre : lecture `anon + authenticated`, écriture `authenticated`. Contient déjà `unknown_place_icon`.
- Page `Settings.tsx` dans `apps/hub/src/components/` (909 lignes) gère déjà plusieurs configs globales (maxEnergy, tiers, regen cycles, distance GPS). On y ajoute une section.

Aucune table, aucune page nouvelle — on étend l'existant.

---

## Composants à créer / modifier

### 1. DB — nouvelle migration SQL

Fichier : `supabase/migrations/<nnn>_share_text_template.sql`

```sql
-- Ajout du template de partage éditable depuis le hub
insert into public.app_settings (key, value)
values ('share_text_template', 'Un trésor oublié t''attend sur Runes de Chêne. Viens explorer {name}.')
on conflict (key) do nothing;
```

### 2. Hub — `apps/hub/src/components/Settings.tsx`

Nouvelle section **"Partage social"** :
- Textarea pour le template (une ligne autorisée)
- Helper text : *"Utilise `{name}` pour insérer le nom du lieu"*
- Preview live : le template rendu avec un lieu exemple (ex. *Abbaye de Fontenay*)
- Save via UPDATE sur `app_settings` (pattern SaveBar déjà en place dans le fichier)
- **Pas de validation forçante** du placeholder `{name}` — l'admin est maître

### 3. App — explore-web

**Nouveau store** : `apps/explore-web/src/stores/appConfigStore.ts` (Zustand)
- State : `shareTextTemplate: string | null`
- Action `fetchConfig()` : SELECT sur `app_settings`, remplit le state
- Fallback hardcodé dans le store : `"Un trésor oublié t'attend sur Runes de Chêne. Viens explorer {name}."` (utilisé si fetch échoue)
- Pas de persist localStorage — refresh à chaque session de l'app
- Réutilisable pour les futurs app-wide configs (`unknown_place_icon`, etc.)

**Nouveau composant** : `apps/explore-web/src/components/places/ShareButton.tsx`
- Props : `place: PlaceDetail`
- Icône standard de partage en **SVG inline** (le projet n'utilise pas de lib d'icônes tierce — cohérent avec `WishlistButton` et la philosophie no-over-engineering)
- Click handler : résout le template, appelle `navigator.share` ou fallback clipboard
- Utilise `useToastStore` existant pour le toast

**Intégration** dans `apps/explore-web/src/components/places/PlacePanel.tsx` :
- Placement : header du panel, à gauche du bouton fermer (P1)
- Visible dans `PlaceContent` (lieu découvert) ET `FoggedPlaceView` (lieu brouillard)

### 4. SEO Page — seo-pages

**Nouvelle lib** : `apps/seo-pages/src/lib/appSettings.ts` (ou ajout dans `places.ts`)
- Fonction `getAppSetting(key: string): Promise<string | null>`

**Build flow** — `apps/seo-pages/src/build.ts` :
- Au début du build, fetch `share_text_template` une fois
- Passé aux templates lors de la génération de chaque page

**Templates** — `apps/seo-pages/src/templates/header.ts`
- Ajout du bouton Partager dans la nav transparente
- Icône en SVG inline (la stack SEO Pages est vanilla, aucune lib)
- Script JS vanilla inline (même pattern que la lightbox de `templates/gallery.ts`) qui fait `navigator.share` ou fallback clipboard
- Toast via une petite div fixe en bas de page, affichée/masquée en JS avec fade (CSS transition)

---

## Click handler — logique de référence

```ts
async function handleShare(place, template) {
  const text = template.replace('{name}', place.name)
  const url = `https://carte.runesdechene.com/lieu/${place.slug}`
  
  try {
    if (navigator.share) {
      await navigator.share({ title: place.name, text, url })
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url)
      toast('Lien copié ✓')
    } else {
      toast(url) // dernier fallback : URL brute
    }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Échec du partage')
  }
}
```

---

## Error handling

| Cas | Comportement |
|---|---|
| User annule le share sheet (`AbortError`) | Silence — c'est normal |
| `navigator.share` indisponible | Fallback `navigator.clipboard` + toast "Lien copié ✓" |
| `navigator.clipboard` aussi indisponible | Toast avec l'URL brute affichée |
| Fetch `app_settings` échoue (app runtime) | Fallback au template hardcodé dans le store |
| Fetch `app_settings` échoue (SEO build) | Build fail volontaire (on veut savoir) |
| Template ne contient pas `{name}` | Accepté — l'admin est maître, pas de nom interpolé |
| Lieu sans slug (théoriquement impossible après migration 091) | Bouton masqué |

---

## Testing (manuel, pas de tests auto à ce stade)

- **iPhone Safari** : share sheet natif s'ouvre avec WhatsApp/SMS/Instagram
- **Android Chrome** : pareil
- **Desktop Chrome/Firefox/Safari** : clipboard + toast
- **Safari privé iOS** (localStorage bloqué) : clipboard fonctionne quand même
- **Edit du texte dans le hub** → changement immédiat dans l'app (runtime fetch) → dans SEO Page après le prochain rebuild (nightly 3h UTC, ou manuel)
- **Edit texte sans `{name}`** → vérifier que le share fonctionne (sans nom interpolé dans le texte)
- **Lieu non découvert** (FoggedPlaceView) → bouton présent et fonctionnel

---

## Référence

- Session Uriel ↔ XO du **2026-04-21**
- 4 questions de brainstorming tranchées : mécanique (Q1=B), visibilité (Q2=A), placement (Q3=P1+S1), ton (Q4=T2)
- Architecture simplifiée : infrastructure `app_settings` + `Settings.tsx` déjà en place, rien à créer côté infra
- Latence 24h max sur SEO Page acceptée par Uriel
- Feature "faction dominante sur SEO Page" reportée à plus tard
