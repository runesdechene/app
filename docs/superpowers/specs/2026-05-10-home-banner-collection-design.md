# Bannière Collection — Home page explore-web

> Spec design — 2026-05-10
> Brainstorm avec Uriel (XO)

## Contexte

Aujourd'hui, la promotion des collections de la boutique en ligne (`runesdechene.com`) depuis l'app passe uniquement par les **publicités plein écran** (`AdScreen.tsx`) qui s'affichent à l'entrée de la carte. C'est intrusif (le user ne peut y échapper, mécanique de loading screen) et contraint à un seul moment du parcours.

On veut un canal de promotion **passif** : une bannière sur la home page de l'app que le user voit en scrollant, qui mène vers une collection Shopify. Configurable depuis le hub.

## Hors-scope (MVP)

- Programmation temporelle (date début/fin) — toggle actif/inactif manuel suffit pour le rythme actuel
- Tracking impressions/clicks — pas de complexification gratuite
- Anti-répétition de rotation — random pur, page rarement rechargée en PWA
- Refresh auto pendant la session — bannière fixée au mount

À ré-évaluer après quelques semaines de production si le besoin émerge.

## Décisions de design

| Décision | Choix | Justification |
|---|---|---|
| **Multiplicité** | N bannières actives, **rotation aléatoire** au mount | Aligné sur pattern `get_random_ad`. Simple. |
| **Activation** | Toggle manuel `active=true/false` | Pas de planification temporelle pour MVP. |
| **Position home** | **En tout premier**, avant `DailyEnigmaCard` | Choix Uriel : signal commercial fort dès l'ouverture. |
| **Layout** | **Full-bleed** : image fond + texte overlay + gradient gauche pour lisibilité | Cohérent avec esthétique Chevalier Errant ; image fait le boulot. |
| **Architecture DB** | **Nouvelle table dédiée** `home_banners` | Séparation propre vs `ad_screens` (sémantique différente : passive home ≠ overlay intrusif). |
| **Lien externe** | `window.open(linkUrl, '_blank', 'noopener,noreferrer')` | Cohérent avec `AdScreen` ; ne casse pas la session PWA. |

## Architecture

### 1. Base de données

```sql
-- Migration : home_banners + RPC

CREATE TABLE public.home_banners (
  id          BIGSERIAL PRIMARY KEY,
  image_url   TEXT NOT NULL,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  link_url    TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Lecture publique des actives (consommée par get_random_home_banner)
CREATE POLICY "home_banners read active" ON public.home_banners
  FOR SELECT USING (active = true);
-- CRUD admin via service_role côté hub (pattern aligné sur ad_screens)

CREATE OR REPLACE FUNCTION public.get_random_home_banner()
RETURNS JSONB
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id',       id,
    'imageUrl', image_url,
    'title',    title,
    'subtitle', subtitle,
    'linkUrl',  link_url
  )
  FROM public.home_banners
  WHERE active = true
  ORDER BY random()
  LIMIT 1;
$$;
```

**Retour `null` si aucune bannière active** — le frontend gère ce cas en ne rendant rien.

### 2. Storage Supabase

Nouveau bucket à créer **manuellement** dans Supabase Studio :

- Nom : `home-banners`
- Public read : oui
- Politique upload : service_role only (admin via hub)

> ⚠️ **Action manuelle Uriel** : créer le bucket avant déploiement de la migration. Les buckets ne se créent pas via SQL.

### 3. Hub — `apps/hub/src/components/Banners.tsx`

**Nouvelle entrée sidebar** "Bannières" + route `/banners` dans `App.tsx`.

Composant ~200 lignes, structure alignée sur `Ads.tsx` :

- État `banners` / `savedBanners` pour le diff `hasChanges`
- Fetch initial : `supabase.from('home_banners').select('*').order('created_at', { ascending: false })`
- Upload image → bucket `home-banners` (path `banner-${Date.now()}.${ext}`) → insert row avec `image_url` calculé via `getPublicUrl`
- Champs éditables : `title`, `subtitle`, `link_url`, `active` (toggle)
- Suppression : `confirm()` natif → delete row + cleanup storage
- Pattern `<SaveBar>` (bulk save) cohérent avec le reste du hub
- (Optionnel — bonus UX) preview live mini-render du layout B avec les valeurs courantes

### 4. Explore-web — `apps/explore-web/src/components/home/HomeBannerCard.tsx`

**Composant** :

```tsx
interface Banner {
  id: number
  imageUrl: string
  title: string
  subtitle: string | null
  linkUrl: string
}

export function HomeBannerCard({ onLoaded }: { onLoaded: (hasBanner: boolean) => void }) {
  const [banner, setBanner] = useState<Banner | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_random_home_banner').then(({ data }) => {
      if (cancelled) return
      const b = data as Banner | null
      setBanner(b)
      onLoaded(!!b)
    })
    return () => { cancelled = true }
  }, [])

  if (!banner) return null

  function handleClick() {
    window.open(banner.linkUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <button type="button" className="home-banner-card" onClick={handleClick}>
      <img src={banner.imageUrl} alt="" className="home-banner-card-img" />
      <div className="home-banner-card-overlay" aria-hidden />
      <div className="home-banner-card-text">
        <span className="home-banner-card-tag">Boutique</span>
        <span className="home-banner-card-title">{banner.title}</span>
        {banner.subtitle && (
          <span className="home-banner-card-sub">{banner.subtitle}</span>
        )}
      </div>
    </button>
  )
}
```

**CSS** (extrait critique) :

```css
.home-banner-card {
  width: 100%;
  height: 110px;
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--color-sepia);
  box-shadow: 0 4px 14px rgba(74, 55, 40, 0.18);
  cursor: pointer;
  background: transparent;
  padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.home-banner-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(74, 55, 40, 0.24);
}
.home-banner-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.home-banner-card-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(15,10,5,0.85) 0%, rgba(15,10,5,0.5) 60%, rgba(15,10,5,0.2) 100%);
}
.home-banner-card-text {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; justify-content: center;
  padding: 18px 20px; gap: 4px;
}
.home-banner-card-tag {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em;
  color: var(--color-sepia); font-weight: 700;
  font-family: var(--font-accent);
  text-shadow: 0 1px 3px rgba(0,0,0,0.85);
}
.home-banner-card-title {
  font-size: 20px; color: #fff;
  font-family: var(--font-title);
  font-weight: 400; letter-spacing: 0.04em; text-transform: uppercase;
  line-height: 1.15;
  text-shadow: 0 1px 4px rgba(0,0,0,0.9);
}
.home-banner-card-sub {
  font-size: 13px; color: #f0e4cc; line-height: 1.3;
  font-style: italic; font-family: var(--font-signature);
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
}
```

Variables CSS et typographies alignées sur `DailyEnigmaCard.css` (`--color-sepia`, `--font-title`, `--font-signature`, `--font-accent`) — l'image est sombre donc on bascule le texte en blanc/sépia avec text-shadow pour la lisibilité.

### 5. Intégration `HomePage.tsx`

```tsx
const [hasBanner, setHasBanner] = useState(false)

return (
  <main className="home-page-scroll">
    {hasBanner && (
      <section className="home-section">
        <HomeBannerCard onLoaded={setHasBanner} />
      </section>
    )}
    <section className="home-section">
      <DailyEnigmaCard ... />
    </section>
    {/* ... reste inchangé */}
  </main>
)
```

**Note** : on rend la `<section>` conditionnellement APRÈS le premier load. Au tout premier render, `hasBanner=false` donc pas de section. Une fois le RPC résolu :
- Si bannière active → `setHasBanner(true)` → la section apparaît (léger CLS, acceptable car au-dessus du fold)
- Si pas de bannière → reste à `false`, section jamais rendue

Alternative envisagée et écartée : monter le composant inconditionnellement et lui faire retourner `null` — ça laisse un `<section className="home-section">` vide avec son padding, ce qui crée un trou visuel. Le state remonté évite ça.

## Critères de complétion

- [ ] Migration SQL appliquée (table + RLS + RPC)
- [ ] Bucket `home-banners` créé manuellement (public read)
- [ ] `Banners.tsx` fonctionnel : upload, CRUD, toggle, suppression cleanup storage
- [ ] Sidebar hub mise à jour + route
- [ ] `HomeBannerCard.tsx` rend layout B en prod
- [ ] `HomePage.tsx` gère le `null` proprement (pas de section vide)
- [ ] Test manuel : 0 bannière active → pas de section ; 1 active → bannière visible ; 3 actives → rotation à chaque reload
- [ ] Click → ouvre la collection Shopify dans nouvel onglet, ne casse pas la session PWA
- [ ] Build OK + lint OK

## Risques / points d'attention

1. **Performance image** — les images sources doivent être compressées (WebP, < 100ko idéalement). Le hub pourrait afficher la taille uploadée pour alerter ; pas critique pour MVP.
2. **CLS au mount** — la bannière apparaît après le RPC, donc léger saut visuel. Si gênant, on peut réserver l'espace via `min-height: 110px` sur la section avant résolution. À tester en prod.
3. **Cache RPC** — `get_random_home_banner` est marquée `STABLE`. C'est légèrement contradictoire avec `random()` (la fonction n'est pas vraiment stable), mais en pratique chaque appel SQL refait un tirage : pas de cache d'opérateur observé. Si en prod on voit deux mounts consécutifs servir la même bannière, on bascule en `VOLATILE`.
