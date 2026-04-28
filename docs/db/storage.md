# Storage — buckets et paths

## Bucket unique : `place-images`

Toutes les images (lieux + avatars) vivent dans **un seul bucket** : `place-images`, **public**.

Les nouveaux buckets ne peuvent **pas** être créés via migration SQL — voir `gotchas.md` → "Buckets — création manuelle".

## Convention de paths

### Lieux

```
places/{authorId}/{imageId}.webp         # full
places/{authorId}/{imageId}_thumb.webp   # thumb
```

### Avatars

```
avatars/{userId}.webp
```

## Specs

- **Full** : 1920px max, WebP qualité 82%
- **Thumb** : 400px max, WebP qualité 82%

## Modèle DB

### `places.images` — JSONB
```json
[
  { "id": "abc123", "url": "...", "thumb": "..." }
]
```

**Pas un array Postgres** — un JSONB. Les queries doivent utiliser les opérateurs JSONB (`->`, `->>`, `jsonb_array_elements`).

### `users.avatar_url` — TEXT
Prioritaire sur le legacy `image_media`. Pointe vers `place-images/avatars/{userId}.webp`.

## Code

- Compression : `apps/explore-web/src/lib/compressImage.ts`
- Helpers : chercher via Graphify (`compressImage()`, `isImage()`, `isMediaFile()`)
