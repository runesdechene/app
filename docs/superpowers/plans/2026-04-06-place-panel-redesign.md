# PlacePanel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the PlacePanel (discovered place view) as a collaborative journal with hero photo, parchment influence frame, explorers, and tabbed content (Carnets with embedded photos/ratings, Gallery grid, structured Info fields).

**Architecture:** Pure frontend rewrite of `DiscoveredPlaceContent` in PlacePanel.tsx + one small DB migration (add `images JSONB` column to `place_contributions` for multi-photo carnets). The V0.5 RPCs are already deployed. New components: `CarnetCard`, `PlaceGallery`, `PlaceInfos`, `AddCarnetModal`. Existing V0.5 components (`InfluenceButton`, `InfluenceFlags`, `PlaceExplorers`, `WishlistButton`) are restyled and repositioned.

**Tech Stack:** React 18 · TypeScript strict · Vite 5 · Supabase RPCs · Plain CSS (co-located per component) · Zustand stores

**Spec:** `docs/superpowers/specs/2026-04-06-place-panel-redesign.md`

---

## File Structure

| File | Role | Action |
|------|------|--------|
| `supabase/migrations/019_v05_contributions_images.sql` | Add `images JSONB` column to `place_contributions` | Create |
| `apps/explore-web/src/components/places/PlacePanel.tsx` | Main panel — rewrite DiscoveredPlaceContent | Rewrite |
| `apps/explore-web/src/components/places/PlacePanel.css` | Full CSS rewrite for new layout | Rewrite |
| `apps/explore-web/src/components/places/CarnetCard.tsx` | Single carnet entry (text + photos + rating + influence) | Create |
| `apps/explore-web/src/components/places/CarnetCard.css` | Carnet card styles | Create |
| `apps/explore-web/src/components/places/AddCarnetModal.tsx` | Modal: write carnet text + upload photos + rate | Create |
| `apps/explore-web/src/components/places/AddCarnetModal.css` | Add carnet modal styles | Create |
| `apps/explore-web/src/components/places/PlaceGallery.tsx` | Grid of all photos from all carnets | Create |
| `apps/explore-web/src/components/places/PlaceGallery.css` | Gallery styles | Create |
| `apps/explore-web/src/components/places/PlaceInfos.tsx` | Structured info fields (accessibility, season, warning) | Create |
| `apps/explore-web/src/components/places/PlaceInfos.css` | Info fields styles | Create |
| `apps/explore-web/src/components/places/InfluenceFrame.tsx` | Parchment-framed influence section (flags + CTA + stock) | Create |
| `apps/explore-web/src/components/places/InfluenceFrame.css` | Influence frame styles | Create |
| `apps/explore-web/src/components/places/PlaceExplorers.tsx` | Restyle existing explorer row | Modify |
| `apps/explore-web/src/components/places/PlaceExplorers.css` | Update explorer styles | Modify |
| `apps/explore-web/src/components/places/WishlistButton.tsx` | Keep as-is (pill style) | Keep |
| `.archives/migrations/019_v05_contributions_images.sql` | Archive copy | Create |

---

## Task 1 : Migration — ajouter `images JSONB` à place_contributions

**Files:**
- Create: `supabase/migrations/019_v05_contributions_images.sql`
- Create: `.archives/migrations/019_v05_contributions_images.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- 019_v05_contributions_images.sql
-- Ajouter support multi-photos sur les contributions (carnets)
-- Les photos étaient un type séparé, maintenant elles sont embarquées dans le carnet

ALTER TABLE place_contributions ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN place_contributions.images IS 'Array of image URLs attached to this contribution. Format: ["url1", "url2", ...]';
```

- [ ] **Step 2: Copier dans .archives/migrations/**

```bash
cp supabase/migrations/019_v05_contributions_images.sql .archives/migrations/019_v05_contributions_images.sql
```

- [ ] **Step 3: Déployer**

```bash
cd '/c/Users/uriel/desktop/DEVS/app (Runes de Chêne)' && npx supabase db push
```

- [ ] **Step 4: Vérifier**

```bash
npx supabase db query --linked "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'place_contributions' AND column_name = 'images';"
```

Expected: `images` column of type `jsonb`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/019_v05_contributions_images.sql .archives/migrations/019_v05_contributions_images.sql
git commit -m "feat: add images JSONB column to place_contributions for multi-photo carnets"
```

---

## Task 2 : CarnetCard — composant d'une page de carnet

**Files:**
- Create: `apps/explore-web/src/components/places/CarnetCard.tsx`
- Create: `apps/explore-web/src/components/places/CarnetCard.css`

- [ ] **Step 1: Créer CarnetCard.tsx**

```typescript
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import './CarnetCard.css'

export interface Carnet {
  id: number
  userId: string
  factionId: string
  content: string
  images: string[]        // URLs des photos liées
  rating: number | null   // 1-5 étoiles (null si pas noté)
  votesUp: number
  votesDown: number
  createdAt: string
  userName: string
  userAvatar: string | null
  // Calculé côté client
  influenceTotal?: number
  influenceBreakdown?: { text: number; photos: number; votes: number }
}

interface CarnetCardProps {
  carnet: Carnet
  isTop: boolean
  factionColor: string | null
  influencePerCarnet: number   // from app_settings
  influencePerPhoto: number
  influencePerVote: number
  onVoted: () => void
}

export function CarnetCard({ carnet, isTop, factionColor, influencePerCarnet, influencePerPhoto, influencePerVote, onVoted }: CarnetCardProps) {
  const userId = usePlayerStore(s => s.userId)
  const [voting, setVoting] = useState(false)

  const textInfluence = influencePerCarnet
  const photosInfluence = carnet.images.length * influencePerPhoto
  const votesInfluence = carnet.votesUp * influencePerVote
  const totalInfluence = textInfluence + photosInfluence + votesInfluence

  async function vote(direction: 1 | -1) {
    if (!userId || voting) return
    setVoting(true)
    const { error } = await supabase.rpc('vote_contribution', {
      p_user_id: userId,
      p_contribution_id: carnet.id,
      p_vote: direction,
    })
    if (!error) onVoted()
    setVoting(false)
  }

  const timeAgo = getTimeAgo(carnet.createdAt)

  return (
    <div className={`carnet-card${isTop ? ' carnet-card-top' : ''}`} id={`carnet-${carnet.id}`}>
      {/* Header */}
      <div className="carnet-header">
        <button
          className="carnet-author"
          onClick={() => useMapStore.getState().setSelectedPlayerId(carnet.userId)}
        >
          {carnet.userAvatar ? (
            <img className="carnet-avatar" src={carnet.userAvatar} alt="" />
          ) : (
            <span className="carnet-avatar carnet-avatar-fallback">
              {carnet.userName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="carnet-name">{carnet.userName}</span>
        </button>
        {factionColor && (
          <span className="carnet-faction-dot" style={{ backgroundColor: factionColor }} />
        )}
        {carnet.rating !== null && (
          <span className="carnet-stars">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i < carnet.rating! ? 'star-filled' : 'star-empty'}>★</span>
            ))}
          </span>
        )}
      </div>

      {/* Text */}
      <p className="carnet-text">{carnet.content}</p>

      {/* Photos */}
      {carnet.images.length > 0 && (
        <div className="carnet-photos">
          {carnet.images.map((url, i) => (
            <img key={i} src={url} alt="" className="carnet-photo" loading="lazy" />
          ))}
        </div>
      )}

      {/* Footer: votes + date */}
      <div className="carnet-footer">
        <button className="carnet-vote-btn" onClick={() => vote(1)} disabled={voting || !userId}>
          👍 {carnet.votesUp}
        </button>
        <button className="carnet-vote-btn" onClick={() => vote(-1)} disabled={voting || !userId}>
          👎 {carnet.votesDown}
        </button>
        <span className="carnet-date">{timeAgo}</span>
      </div>

      {/* Influence line */}
      <div className="carnet-influence-line">
        <span
          className="carnet-influence-badge"
          style={{ backgroundColor: factionColor ?? '#8a7a6a' }}
        >
          🏰 +{totalInfluence}
        </span>
        <span className="carnet-influence-breakdown">
          📖 texte +{textInfluence}
          {photosInfluence > 0 && <> · 📷 photos +{photosInfluence}</>}
          {votesInfluence > 0 && <> · 👍 votes +{votesInfluence}</>}
        </span>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days}j`
  const weeks = Math.floor(days / 7)
  return `il y a ${weeks} sem.`
}
```

- [ ] **Step 2: Créer CarnetCard.css**

```css
.carnet-card {
  background: #faf6ec;
  border: 1px solid var(--color-parchment-dark);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
}
.carnet-card-top {
  border-left: 3px solid #c9a96e;
}

/* Header */
.carnet-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.carnet-author {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: inherit;
}
.carnet-author:hover .carnet-name { color: var(--color-ink); }
.carnet-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--color-parchment-dark);
  flex-shrink: 0;
}
.carnet-avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-parchment-dark);
  color: var(--color-ink-light);
  font-family: var(--font-accent);
  font-size: 12px;
  font-weight: 600;
}
.carnet-name {
  font-family: var(--font-accent);
  font-size: 13px;
  font-weight: 700;
  color: var(--color-ink);
  transition: color 0.15s;
}
.carnet-faction-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.carnet-stars {
  margin-left: auto;
  font-size: 12px;
  letter-spacing: 1px;
}
.star-filled { color: #c9a96e; }
.star-empty { color: #c9a96e; opacity: 0.25; }

/* Text */
.carnet-text {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-ink);
  font-style: italic;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

/* Photos */
.carnet-photos {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  overflow-x: auto;
}
.carnet-photo {
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.15s;
}
.carnet-photo:hover { opacity: 0.85; }

/* Footer */
.carnet-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-ink-light);
}
.carnet-vote-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--color-ink-light);
  padding: 2px 4px;
  transition: color 0.15s;
}
.carnet-vote-btn:hover:not(:disabled) { color: var(--color-ink); }
.carnet-vote-btn:disabled { opacity: 0.5; cursor: default; }
.carnet-date {
  margin-left: auto;
  font-size: 11px;
  font-family: var(--font-body);
}

/* Influence line */
.carnet-influence-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-parchment-dark);
}
.carnet-influence-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-accent);
  color: white;
  flex-shrink: 0;
}
.carnet-influence-breakdown {
  font-size: 10px;
  color: var(--color-ink-light);
  font-family: var(--font-accent);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/CarnetCard.tsx apps/explore-web/src/components/places/CarnetCard.css
git commit -m "feat: add CarnetCard component (text + photos + rating + influence)"
```

---

## Task 3 : InfluenceFrame — cadre parchemin encadré

**Files:**
- Create: `apps/explore-web/src/components/places/InfluenceFrame.tsx`
- Create: `apps/explore-web/src/components/places/InfluenceFrame.css`

- [ ] **Step 1: Créer InfluenceFrame.tsx**

```typescript
import { usePlayerStore } from '../../stores/playerStore'
import './InfluenceFrame.css'

interface InfluenceEntry {
  factionId: string
  placed: number
  content: number
  total: number
}

interface InfluenceFrameProps {
  placeId: string
  influence: InfluenceEntry[]
  factionColors: Map<string, string>
  placeLocation: { latitude: number; longitude: number }
  onInfluencePlaced: () => void
}

export function InfluenceFrame({ placeId, influence, factionColors, placeLocation, onInfluencePlaced }: InfluenceFrameProps) {
  const influenceStock = usePlayerStore(s => s.influenceStock)
  const userId = usePlayerStore(s => s.userId)
  const gameMode = usePlayerStore(s => s.gameMode)

  if (gameMode !== 'conquest') return null

  // Find dominant faction
  const sorted = [...influence].sort((a, b) => b.total - a.total)
  const dominantId = sorted[0]?.factionId

  return (
    <div className="influence-frame">
      <div className="influence-frame-title">Influence des Héritages</div>

      {influence.length > 0 ? (
        <div className="influence-flags">
          {sorted.map(entry => (
            <span
              key={entry.factionId}
              className="influence-flag"
              style={{ backgroundColor: factionColors.get(entry.factionId) ?? '#8a7a6a' }}
            >
              {entry.total}
              {entry.factionId === dominantId && ' ⭐'}
            </span>
          ))}
        </div>
      ) : (
        <p className="influence-empty">Aucune faction n'a encore posé son empreinte ici.</p>
      )}

      {userId && (
        <>
          <button
            className="influence-cta"
            onClick={() => {
              // Delegate to InfluenceButton logic — will be wired in PlacePanel
              const event = new CustomEvent('open-influence-action', {
                detail: { placeId, placeLocation },
              })
              window.dispatchEvent(event)
            }}
          >
            🏰 Placer de l'influence
          </button>
          <div className="influence-stock-label">
            Ton stock : {influenceStock} point{influenceStock !== 1 ? 's' : ''} disponible{influenceStock !== 1 ? 's' : ''}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Créer InfluenceFrame.css**

```css
.influence-frame {
  background: linear-gradient(135deg, #faf3e0 0%, #f0e6cc 100%);
  border: 2px solid #c9a96e;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
  position: relative;
}
.influence-frame::before {
  content: '';
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(201, 169, 110, 0.3);
  border-radius: 5px;
  pointer-events: none;
}

.influence-frame-title {
  font-family: var(--font-accent);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--color-ink-light);
  margin-bottom: 10px;
  text-align: center;
}

.influence-flags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 12px;
}
.influence-flag {
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  font-family: var(--font-accent);
}

.influence-empty {
  text-align: center;
  font-size: 12px;
  color: var(--color-ink-light);
  font-style: italic;
  margin-bottom: 12px;
}

.influence-cta {
  display: block;
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #5a4a3a, #3a2a1a);
  color: var(--color-parchment);
  border: none;
  border-radius: 6px;
  font-family: var(--font-title);
  font-size: 15px;
  text-align: center;
  cursor: pointer;
  transition: opacity 0.2s;
}
.influence-cta:hover { opacity: 0.85; }

.influence-stock-label {
  text-align: center;
  font-size: 11px;
  color: var(--color-ink-light);
  margin-top: 6px;
  font-family: var(--font-accent);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/InfluenceFrame.tsx apps/explore-web/src/components/places/InfluenceFrame.css
git commit -m "feat: add InfluenceFrame parchment component"
```

---

## Task 4 : PlaceGallery — grille de photos

**Files:**
- Create: `apps/explore-web/src/components/places/PlaceGallery.tsx`
- Create: `apps/explore-web/src/components/places/PlaceGallery.css`

- [ ] **Step 1: Créer PlaceGallery.tsx**

```typescript
import './PlaceGallery.css'

interface GalleryPhoto {
  url: string
  carnetId: number
}

interface PlaceGalleryProps {
  photos: GalleryPhoto[]
  onPhotoClick: (carnetId: number) => void
}

export function PlaceGallery({ photos, onPhotoClick }: PlaceGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="gallery-empty">
        Aucune photo pour l'instant. Ajoutez des photos à votre carnet !
      </div>
    )
  }

  return (
    <div className="gallery-grid">
      {photos.map((photo, i) => (
        <button
          key={`${photo.carnetId}-${i}`}
          className="gallery-item"
          onClick={() => onPhotoClick(photo.carnetId)}
        >
          <img src={photo.url} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Créer PlaceGallery.css**

```css
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.gallery-item {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 4px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.15s;
}
.gallery-item:hover img { opacity: 0.85; }

.gallery-empty {
  text-align: center;
  padding: 32px 16px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-ink-light);
  font-style: italic;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/PlaceGallery.tsx apps/explore-web/src/components/places/PlaceGallery.css
git commit -m "feat: add PlaceGallery grid component"
```

---

## Task 5 : PlaceInfos — champs structurés wiki

**Files:**
- Create: `apps/explore-web/src/components/places/PlaceInfos.tsx`
- Create: `apps/explore-web/src/components/places/PlaceInfos.css`

- [ ] **Step 1: Créer PlaceInfos.tsx**

```typescript
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './PlaceInfos.css'

interface InfoField {
  type: 'accessibility' | 'season' | 'warning'
  content: string | null
  userName: string | null
  updatedAt: string | null
}

interface PlaceInfosProps {
  placeId: string
  infos: InfoField[]
  onRefresh: () => void
}

const INFO_CONFIG = {
  accessibility: { icon: '♿', label: 'Accessibilité', placeholder: 'Facile / Modéré / Difficile + détails...' },
  season: { icon: '🌿', label: 'Saison idéale', placeholder: 'Printemps, été, toute l\'année...' },
  warning: { icon: '⚠️', label: 'Information importante', placeholder: 'Danger, propriété privée, horaires...' },
} as const

export function PlaceInfos({ placeId, infos, onRefresh }: PlaceInfosProps) {
  const userId = usePlayerStore(s => s.userId)

  return (
    <div className="place-infos">
      {(['accessibility', 'season', 'warning'] as const).map(type => {
        const config = INFO_CONFIG[type]
        const existing = infos.find(i => i.type === type)
        return (
          <InfoRow
            key={type}
            placeId={placeId}
            type={type}
            icon={config.icon}
            label={config.label}
            placeholder={config.placeholder}
            content={existing?.content ?? null}
            userName={existing?.userName ?? null}
            updatedAt={existing?.updatedAt ?? null}
            canEdit={!!userId}
            onSaved={onRefresh}
          />
        )
      })}
    </div>
  )
}

function InfoRow({ placeId, type, icon, label, placeholder, content, userName, updatedAt, canEdit, onSaved }: {
  placeId: string
  type: string
  icon: string
  label: string
  placeholder: string
  content: string | null
  userName: string | null
  updatedAt: string | null
  canEdit: boolean
  onSaved: () => void
}) {
  const userId = usePlayerStore(s => s.userId)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!userId || !value.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.rpc('contribute_to_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_type: type,
      p_content: value.trim(),
    })
    if (!error) {
      setEditing(false)
      onSaved()
    }
    setSaving(false)
  }

  return (
    <div className="info-row">
      <div className="info-row-header">
        <span className="info-icon">{icon}</span>
        <span className="info-label">{label}</span>
        {canEdit && !editing && (
          <button className="info-edit-btn" onClick={() => setEditing(true)}>
            Modifier
          </button>
        )}
      </div>

      {editing ? (
        <div className="info-edit">
          <textarea
            className="info-textarea"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            rows={2}
          />
          <div className="info-edit-actions">
            <button className="info-save-btn" onClick={save} disabled={saving || !value.trim()}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button className="info-cancel-btn" onClick={() => { setEditing(false); setValue(content ?? '') }}>
              Annuler
            </button>
          </div>
        </div>
      ) : content ? (
        <div className="info-content">
          <p>{content}</p>
          {userName && updatedAt && (
            <span className="info-meta">Modifié par {userName} · {getTimeAgo(updatedAt)}</span>
          )}
        </div>
      ) : (
        <p className="info-empty">Aucune information renseignée</p>
      )}
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days}j`
  return `il y a ${Math.floor(days / 7)} sem.`
}
```

- [ ] **Step 2: Créer PlaceInfos.css**

```css
.place-infos {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  border: 1px solid var(--color-parchment-dark);
  border-radius: 8px;
  padding: 12px;
  background: #faf6ec;
}
.info-row-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.info-icon { font-size: 14px; }
.info-label {
  font-family: var(--font-accent);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-ink);
}
.info-edit-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-family: var(--font-accent);
  font-size: 11px;
  color: var(--color-sepia-dark);
  cursor: pointer;
  text-decoration: underline;
}
.info-content p {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-ink);
  margin: 0;
  line-height: 1.5;
}
.info-meta {
  font-family: var(--font-accent);
  font-size: 11px;
  color: var(--color-ink-light);
  display: block;
  margin-top: 4px;
}
.info-empty {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-ink-light);
  font-style: italic;
  margin: 0;
}

/* Edit mode */
.info-edit { margin-top: 4px; }
.info-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-parchment-dark);
  border-radius: 6px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-ink);
  background: var(--color-parchment);
  resize: vertical;
}
.info-edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.info-save-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, #5a4a3a, #3a2a1a);
  color: var(--color-parchment);
  border: none;
  border-radius: 6px;
  font-family: var(--font-accent);
  font-size: 12px;
  cursor: pointer;
}
.info-save-btn:disabled { opacity: 0.5; cursor: default; }
.info-cancel-btn {
  padding: 6px 14px;
  background: none;
  border: 1px solid var(--color-parchment-dark);
  border-radius: 6px;
  font-family: var(--font-accent);
  font-size: 12px;
  color: var(--color-ink-light);
  cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/PlaceInfos.tsx apps/explore-web/src/components/places/PlaceInfos.css
git commit -m "feat: add PlaceInfos structured wiki fields component"
```

---

## Task 6 : AddCarnetModal — formulaire carnet + photos + note

**Files:**
- Create: `apps/explore-web/src/components/places/AddCarnetModal.tsx`
- Create: `apps/explore-web/src/components/places/AddCarnetModal.css`

- [ ] **Step 1: Créer AddCarnetModal.tsx**

Le modal doit permettre :
1. Écrire un texte (obligatoire)
2. Uploader 0-N photos (optionnel) — upload vers le bucket `place-images`
3. Donner une note 1-5 (optionnel, actif seulement si le joueur est Explorateur GPS ou découvreur)

```typescript
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './AddCarnetModal.css'

interface AddCarnetModalProps {
  placeId: string
  canRate: boolean    // true si explorateur GPS ou découvreur
  onClose: () => void
  onSaved: () => void
}

export function AddCarnetModal({ placeId, canRate, onClose, onSaved }: AddCarnetModalProps) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function addPhotos(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 5 - photos.length) // max 5 photos
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setPhotos(prev => [...prev, ...newFiles])
    setPreviews(prev => [...prev, ...newPreviews])
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(previews[index])
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function submit() {
    if (!userId || !text.trim() || saving) return
    setSaving(true)
    setError(null)

    // 1. Upload photos
    const imageUrls: string[] = []
    for (const photo of photos) {
      const ext = 'webp'
      const path = `places/${userId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('place-images')
        .upload(path, photo, { contentType: 'image/webp', upsert: false })

      if (uploadErr) {
        setError('Erreur upload photo')
        setSaving(false)
        return
      }
      const { data: urlData } = supabase.storage.from('place-images').getPublicUrl(path)
      imageUrls.push(urlData.publicUrl)
    }

    // 2. Create contribution with type 'carnet'
    // We need to use a direct insert since contribute_to_place doesn't handle images array
    const { error: insertErr } = await supabase
      .from('place_contributions')
      .upsert({
        place_id: placeId,
        user_id: userId,
        faction_id: usePlayerStore.getState().userFactionId,
        type: 'carnet',
        content: text.trim(),
        images: imageUrls,
        rating: rating,
      }, { onConflict: 'place_id,user_id,type' })

    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    // 3. Call contribute_to_place RPC for the rewards (influence, exploration, erudition)
    await supabase.rpc('contribute_to_place', {
      p_user_id: userId,
      p_place_id: placeId,
      p_type: 'carnet',
      p_content: text.trim(),
    })

    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="add-carnet-overlay" onClick={onClose}>
      <div className="add-carnet-modal" onClick={e => e.stopPropagation()}>
        <div className="add-carnet-header">
          <h3>Ma page de carnet</h3>
          <button className="add-carnet-close" onClick={onClose}>✕</button>
        </div>

        <div className="add-carnet-body">
          {/* Text */}
          <textarea
            className="add-carnet-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Votre récit, vos impressions, vos conseils..."
            rows={5}
          />

          {/* Photos */}
          <div className="add-carnet-photos-section">
            <div className="add-carnet-photos-label">
              📷 Photos ({photos.length}/5)
            </div>
            <div className="add-carnet-photos-grid">
              {previews.map((src, i) => (
                <div key={i} className="add-carnet-photo-thumb">
                  <img src={src} alt="" />
                  <button className="add-carnet-photo-remove" onClick={() => removePhoto(i)}>✕</button>
                </div>
              ))}
              {photos.length < 5 && (
                <button className="add-carnet-photo-add" onClick={() => fileRef.current?.click()}>
                  +
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={e => addPhotos(e.target.files)}
            />
          </div>

          {/* Rating */}
          {canRate && (
            <div className="add-carnet-rating">
              <span className="add-carnet-rating-label">Note :</span>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  className={`add-carnet-star ${rating !== null && n <= rating ? 'active' : ''}`}
                  onClick={() => setRating(prev => prev === n ? null : n)}
                >
                  ★
                </button>
              ))}
            </div>
          )}

          {error && <p className="add-carnet-error">{error}</p>}
        </div>

        <div className="add-carnet-footer">
          <button
            className="add-carnet-submit"
            onClick={submit}
            disabled={saving || !text.trim()}
          >
            {saving ? 'Publication...' : 'Publier ma page'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Créer AddCarnetModal.css**

```css
.add-carnet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 12, 5, 0.65);
  display: flex;
  align-items: flex-end;
  z-index: 9998;
  animation: add-carnet-fade 0.2s ease;
}
@keyframes add-carnet-fade { from { opacity: 0; } to { opacity: 1; } }

.add-carnet-modal {
  width: 100%;
  max-height: 85vh;
  background: var(--color-parchment);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.add-carnet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-parchment-dark);
}
.add-carnet-header h3 {
  font-family: var(--font-title);
  font-size: 20px;
  color: var(--color-ink);
  margin: 0;
}
.add-carnet-close {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--color-ink-light);
  cursor: pointer;
  padding: 4px 8px;
}

.add-carnet-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
}

.add-carnet-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-parchment-dark);
  border-radius: 8px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--color-ink);
  background: #faf6ec;
  resize: vertical;
  min-height: 100px;
}
.add-carnet-textarea::placeholder { color: var(--color-ink-light); font-style: italic; }

/* Photos */
.add-carnet-photos-section { margin-top: 14px; }
.add-carnet-photos-label {
  font-family: var(--font-accent);
  font-size: 13px;
  color: var(--color-ink-light);
  margin-bottom: 8px;
}
.add-carnet-photos-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.add-carnet-photo-thumb {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}
.add-carnet-photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.add-carnet-photo-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0,0,0,0.6);
  color: white;
  border: none;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-carnet-photo-add {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  border: 2px dashed var(--color-parchment-dark);
  background: none;
  font-size: 24px;
  color: var(--color-ink-light);
  cursor: pointer;
  transition: border-color 0.15s;
}
.add-carnet-photo-add:hover { border-color: #c9a96e; }

/* Rating */
.add-carnet-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 14px;
}
.add-carnet-rating-label {
  font-family: var(--font-accent);
  font-size: 13px;
  color: var(--color-ink-light);
  margin-right: 6px;
}
.add-carnet-star {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--color-parchment-dark);
  cursor: pointer;
  padding: 0 2px;
  transition: color 0.15s;
}
.add-carnet-star.active { color: #c9a96e; }

.add-carnet-error {
  color: #c0392b;
  font-size: 12px;
  margin-top: 8px;
}

/* Footer */
.add-carnet-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--color-parchment-dark);
}
.add-carnet-submit {
  display: block;
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #5a4a3a, #3a2a1a);
  color: var(--color-parchment);
  border: none;
  border-radius: 8px;
  font-family: var(--font-title);
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.add-carnet-submit:hover:not(:disabled) { opacity: 0.85; }
.add-carnet-submit:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/AddCarnetModal.tsx apps/explore-web/src/components/places/AddCarnetModal.css
git commit -m "feat: add AddCarnetModal (text + photos + rating)"
```

---

## Task 7 : Réécrire PlacePanel.tsx — DiscoveredPlaceContent

**Files:**
- Rewrite: `apps/explore-web/src/components/places/PlacePanel.tsx`

Ce task est le plus gros — il remplace `DiscoveredPlaceContent` par la nouvelle structure. Lis le fichier actuel avant de le modifier (`apps/explore-web/src/components/places/PlacePanel.tsx`).

- [ ] **Step 1: Lire le PlacePanel.tsx actuel**

Le fichier fait ~718 lignes. Les parties à garder :
- `PlacePanel` (wrapper avec backdrop + slide-in)
- `PlaceContent` (dispatch fogged/discovered)
- `V05Detail` interface
- V0.5 data fetching (`useEffect` pour `get_place_detail_v05` + faction colors)
- Admin delete modal + admin options menu + ScoreSlider

Les parties à réécrire :
- **Tout le JSX de `DiscoveredPlaceContent`** — nouvelle structure de la spec
- Supprimer : like system, old explorers, old explore button, description section, claim badge, claim/fortify buttons
- Ajouter : hero photo, identity zone, influence frame, explorers section, tabs (carnets/galerie/infos)

- [ ] **Step 2: Réécrire DiscoveredPlaceContent**

Remplacer le contenu de `DiscoveredPlaceContent` (lignes ~106-718) par la nouvelle structure :

```typescript
// New imports at top of file
import { CarnetCard } from './CarnetCard'
import type { Carnet } from './CarnetCard'
import { InfluenceFrame } from './InfluenceFrame'
import { PlaceGallery } from './PlaceGallery'
import { PlaceInfos } from './PlaceInfos'
import { AddCarnetModal } from './AddCarnetModal'
import { PlaceExplorers } from './PlaceExplorers'
import { WishlistButton } from './WishlistButton'
import { PlaceEnigma } from '../enigma/PlaceEnigma'
import { ScoreSlider } from './ScoreSlider'
```

Le composant `DiscoveredPlaceContent` doit :

1. **State** : `activeTab` ('carnets' | 'galerie' | 'infos'), `showAddCarnet` (boolean), `imageIndex` (hero gallery), plus les états V0.5 existants
2. **Hero photo logic** : prendre les photos des 3 carnets les mieux votés, fallback sur `place.images`
3. **Carnets** : transformer `v05.contributions` en `Carnet[]` — filtrer `type === 'carnet'`, mapper les champs, trier par `votesUp DESC`
4. **Galerie** : extraire toutes les `images` de tous les carnets, trier par votes du carnet parent
5. **Infos** : filtrer les contributions de type `accessibility`, `season`, `warning`
6. **Note moyenne** : calculer la moyenne des `rating` non-null des carnets

Structure JSX (du haut vers le bas) :
```
<>
  {/* Admin delete modal (keep existing) */}
  {/* Admin options menu (keep existing) */}

  {/* Zone 1 — Hero Photo */}
  <div className="place-hero">
    <img src={heroPhoto} ... />
    <div className="place-hero-top-left">
      <button close />
      {isAdmin && <button options />}
    </div>
    <div className="place-hero-top-right">
      <span className="place-hero-pill">★ {avgRating}</span>
      <WishlistButton ... pill style />
    </div>
    {galleryDots}
  </div>

  {/* Zone 2 — Identity */}
  <div className="place-body">
    <div className="place-identity">
      <h2>{place.title}</h2>
      <div className="place-tags">{tags}</div>
      <p className="place-address">{address}</p>
      <div className="place-roles">
        <RoleLink icon="🧭" label="Découvreur" user={author} />
        <RoleLink icon="👑" label="Gardien" user={guardian} />
      </div>
    </div>

    {/* Zone 3A — Influence Frame */}
    <InfluenceFrame ... />

    {/* Zone 3B — Explorers */}
    <PlaceExplorers ... />

    {/* Place Enigma (GPS only) */}
    <PlaceEnigma ... />

    {/* Zone 4 — Tabs */}
    <div className="place-tabs">
      <button className={tab active?}>📖 Carnets ({N})</button>
      <button className={tab active?}>📷 Galerie ({N})</button>
      <button className={tab active?}>ℹ️ Infos ({N})</button>
    </div>

    {/* Tab content */}
    {activeTab === 'carnets' && (
      <>
        {carnets.map((c, i) => <CarnetCard key={c.id} carnet={c} isTop={i === 0} ... />)}
        <button className="place-add-carnet-btn" onClick={() => setShowAddCarnet(true)}>
          ✏️ Ajouter ma page de carnet
        </button>
      </>
    )}
    {activeTab === 'galerie' && <PlaceGallery photos={galleryPhotos} onPhotoClick={scrollToCarnet} />}
    {activeTab === 'infos' && <PlaceInfos placeId={place.id} infos={infoFields} onRefresh={refreshV05} />}

    {/* Admin ScoreSlider */}
    {isAdmin && <ScoreSlider ... />}
  </div>

  {/* Add carnet modal */}
  {showAddCarnet && <AddCarnetModal placeId={place.id} canRate={v05?.isExplorer || isAuthor} onClose={() => setShowAddCarnet(false)} onSaved={refreshV05} />}
</>
```

- [ ] **Step 3: Supprimer les imports inutilisés**

Supprimer les imports de : `ClaimButton`, `FortifyButton`, `InfluenceButton`, `InfluenceFlags`, `PlaceContributions`, `ContributionCard`, `PlaceRating`, `useConstructionTypes`.

- [ ] **Step 4: Vérifier que le build passe**

```bash
cd '/c/Users/uriel/desktop/DEVS/app (Runes de Chêne)/apps/explore-web' && pnpm build 2>&1 | tail -10
```

Expected: build success, 0 TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/places/PlacePanel.tsx
git commit -m "feat: rewrite PlacePanel as collaborative journal (hero photo, influence frame, tabs)"
```

---

## Task 8 : Réécrire PlacePanel.css

**Files:**
- Rewrite: `apps/explore-web/src/components/places/PlacePanel.css`

- [ ] **Step 1: Lire le CSS actuel**

Le fichier fait ~1059 lignes. Les parties à garder :
- `.place-panel` (positionnement, slide-in, scrollbar-hide)
- `.place-panel-open`
- `.place-panel-backdrop`
- `.place-panel-loading`, `.place-panel-error`
- Delete confirm overlay + modal
- Options menu (`.place-options-*`)
- Mobile media queries liées au panneau

Les parties à supprimer :
- Ancien header (`.place-panel-header`)
- Like/likers (`.place-like-*`, `.likers-*`, `.place-liker-*`)
- Explore (`.place-explore-*`, `.explore-confirm-*`)
- Claim/Fortify (`.claim-*`, `.fortify-*`, `.place-claim-*`)
- Notoriety (`.notoriety-*`)
- Faction selector (`.faction-selector-*`)
- Ancien body/title/author/stats/description/address/gallery

Les parties à ajouter :
- Hero photo (`.place-hero`, `.place-hero-top-left`, `.place-hero-top-right`, `.place-hero-pill`, `.place-hero-dots`)
- Identity (`.place-identity`, `.place-roles`, `.place-role-link`)
- Tabs (`.place-tabs`, `.place-tab`, `.place-tab.active`)
- Add carnet button (`.place-add-carnet-btn`)
- Body (`.place-body`)

- [ ] **Step 2: Réécrire le CSS**

Garder les sections du step 1 marquées "à garder". Remplacer tout le reste par le nouveau CSS qui correspond à la spec :

- **Hero** : `position: relative`, photo `height: 320px; object-fit: cover`, pilules semi-transparentes `backdrop-filter: blur(8px)`, dots centrés en bas
- **Identity** : padding 16px, titre `font-family: var(--font-title); font-size: 24px`, tags en flex-wrap, adresse petite, rôles avec border-bottom dashed
- **Tabs** : flex, `border-bottom: 1px solid`, `.place-tab.active::after` trait de 2px
- **Add carnet btn** : `border: 2px dashed`, hover vers doré
- Typographie et espacement : fin, épuré, aéré — laisser respirer

- [ ] **Step 3: Vérifier visuellement**

Ouvrir http://localhost:3000, ouvrir un lieu, vérifier la structure visuelle.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/places/PlacePanel.css
git commit -m "feat: rewrite PlacePanel.css for journal-style layout"
```

---

## Task 9 : Mettre à jour PlaceExplorers pour le nouveau style

**Files:**
- Modify: `apps/explore-web/src/components/places/PlaceExplorers.tsx`
- Modify: `apps/explore-web/src/components/places/PlaceExplorers.css`

- [ ] **Step 1: Lire les fichiers actuels**

Lire `PlaceExplorers.tsx` et `PlaceExplorers.css` pour comprendre le composant existant.

- [ ] **Step 2: Ajuster le style**

Le composant existe déjà et fonctionne. Ajustements nécessaires :
- S'assurer que le label est `🧭 Explorateurs (N)`
- Row d'avatars empilés avec overlap `-6px`
- Bouton "📍 J'y suis allé" avec le style vert discret (pill)
- Le composant doit être autosuffisant (pas de section-title externe)

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/components/places/PlaceExplorers.tsx apps/explore-web/src/components/places/PlaceExplorers.css
git commit -m "fix: restyle PlaceExplorers for new PlacePanel layout"
```

---

## Task 10 : Build + test complet + cleanup

**Files:**
- Verify: all modified files

- [ ] **Step 1: Build**

```bash
cd '/c/Users/uriel/desktop/DEVS/app (Runes de Chêne)/apps/explore-web' && pnpm build 2>&1 | tail -10
```

Expected: 0 errors.

- [ ] **Step 2: Test visuel sur localhost:3000**

Ouvrir l'app, vérifier :
- [ ] Ouvrir un lieu → hero photo visible, pas d'overlay texte
- [ ] Titre, tags, adresse affichés sous la photo
- [ ] Rôles (Découvreur / Gardien) visibles
- [ ] Cadre influence avec double bordure dorée, drapeaux, bouton CTA
- [ ] Explorateurs au-dessus des onglets
- [ ] 3 onglets fonctionnels (Carnets / Galerie / Infos)
- [ ] CarnetCard avec texte, photos, rating, votes, influence breakdown
- [ ] Bouton "Ajouter ma page de carnet" visible

- [ ] **Step 3: Supprimer les fichiers orphelins**

Si les anciens composants V0.5 ne sont plus importés nulle part :
- `PlaceContributions.tsx` / `.css` → à supprimer (remplacé par CarnetCard direct dans PlacePanel)
- `ContributionCard.tsx` / `.css` → à supprimer (remplacé par CarnetCard)
- `AddContributionModal.tsx` / `.css` → à supprimer (remplacé par AddCarnetModal)
- `InfluenceFlags.tsx` / `.css` → à supprimer (intégré dans InfluenceFrame)
- `InfluenceButton.tsx` / `.css` → garder pour l'instant (modal d'action influence)
- `PlaceRating.tsx` / `.css` → à supprimer (la note est dans le carnet)

Vérifier avec grep qu'aucun import ne référence ces fichiers avant de supprimer.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: cleanup old PlacePanel components replaced by journal redesign"
```

---

## Checklist de vérification finale

- [ ] Migration 019 déployée (colonne `images JSONB` sur `place_contributions`)
- [ ] Hero photo : sélection aléatoire parmi top carnets, fallback sur places.images
- [ ] Note moyenne calculée depuis les carnets (pas l'ancien système)
- [ ] Cadre influence visible hors onglets avec double bordure dorée
- [ ] Explorateurs visibles hors onglets, au-dessus des tabs
- [ ] Onglet Carnets : texte + photos + note + votes + influence breakdown
- [ ] Onglet Galerie : grille 3 colonnes, clic → carnet associé
- [ ] Onglet Infos : 3 champs structurés, éditables
- [ ] AddCarnetModal : texte + upload photos + note si éligible
- [ ] Build propre (0 erreurs TypeScript)
- [ ] Anciens composants orphelins supprimés
