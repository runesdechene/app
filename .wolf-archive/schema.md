# Schéma BDD — Post-migration 194

> Source : `information_schema.columns` du 2 avril 2026.

## users
```
id VARCHAR PK, created_at, updated_at, email_address VARCHAR, first_name VARCHAR,
role VARCHAR, display_name TEXT, bio TEXT, biography VARCHAR (legacy), avatar_url TEXT,
instagram TEXT, is_active BOOLEAN, last_login_at TIMESTAMPTZ,
faction_id VARCHAR FK→factions, game_mode VARCHAR DEFAULT 'exploration',
energy_points NUMERIC DEFAULT 5, max_energy NUMERIC DEFAULT 3, energy_reset_at TIMESTAMPTZ,
conquest_points NUMERIC (legacy), max_conquest NUMERIC (legacy), conquest_reset_at (legacy),
construction_points NUMERIC (legacy), max_construction NUMERIC (legacy), construction_reset_at (legacy),
vitalite_points NUMERIC (legacy), max_vitalite NUMERIC (legacy), vitalite_reset_at (legacy),
notoriety_points INT DEFAULT 0 (= Gloire),
displayed_general_title_ids INT[] (legacy v2), displayed_title_ids_v3 INT[],
shopify_customer_id BIGINT (UNIQUE, nullable), account_source VARCHAR ('app'|'shopify')
```
⚠️ `first_name` PAS `name`. `bio` ET `biography` existent (legacy). `text` n'existe PAS.
⚠️ `profile_image_id` n'existe PLUS. `account_source` : `'app'` ou `'shopify'` uniquement (CHECK, pas de `'both'`).

## places
```
id VARCHAR PK, created_at, updated_at, author_id VARCHAR FK→users,
place_type_id VARCHAR FK→place_types, title VARCHAR, text TEXT (= description),
address VARCHAR, latitude REAL, longitude REAL, images JSONB,
accessibility VARCHAR, sensible BOOLEAN, begin_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
faction_id VARCHAR FK→factions, claimed_by VARCHAR FK→users, claimed_at TIMESTAMPTZ,
claimed_avatar_url TEXT, fortification_level INT DEFAULT 0
```
⚠️ Description = `text` PAS `description`. `images` = JSONB. Pas de colonne `score` (calculé dynamiquement). `author_id` PAS `created_by`.

## factions
```
id VARCHAR PK, title VARCHAR, color VARCHAR, pattern VARCHAR (SVG URL),
order INT, description TEXT, image_url TEXT,
bonus_energy NUMERIC, bonus_regen_energy NUMERIC,
bonus_conquest/construction/regen_conquest/regen_construction/vitalite/regen_vitalite NUMERIC (legacy)
```

## tags
```
id VARCHAR PK, title VARCHAR, color VARCHAR, background VARCHAR, icon VARCHAR (SVG URL),
order INT, base_cost NUMERIC DEFAULT 1.0, gauge VARCHAR (legacy),
reward_energy/conquest/construction INT (legacy)
```

## titles
```
id SERIAL PK, name VARCHAR, type VARCHAR ('general'|'faction'), faction_id VARCHAR,
order INT, icon VARCHAR, description TEXT, condition JSONB, unlocks TEXT[], created_at
```

## title_fragments
```
id SERIAL PK, name VARCHAR, description TEXT, icon VARCHAR, icon_url TEXT, image_url TEXT,
link_url TEXT, collection VARCHAR, visible BOOLEAN, bonus_type VARCHAR, bonus_value NUMERIC,
ability_type VARCHAR, ability_cooldown_hours INT DEFAULT 24, ability_value NUMERIC DEFAULT 0
```

## fragment_words
```
id SERIAL PK, fragment_id INT FK→title_fragments, word VARCHAR, slot VARCHAR, gender VARCHAR
```

## user_fragments
```
user_id VARCHAR FK→users, fragment_id INT FK→title_fragments, unlocked_at, source VARCHAR
```

## fragment_ability_uses
```
user_id VARCHAR PK, fragment_id INT PK, used_at TIMESTAMPTZ
```

## faction_tag_bonuses
```
faction_id VARCHAR PK FK→factions, tag_id VARCHAR PK FK→tags, cost_reduction NUMERIC(5,2)
```

## place_tags
```
place_id VARCHAR PK, tag_id VARCHAR PK, is_primary BOOLEAN, created_at
```

## places_discovered
```
user_id VARCHAR, place_id VARCHAR, method VARCHAR, discovered_at TIMESTAMPTZ
```

## place_claims
```
id SERIAL, place_id VARCHAR, user_id VARCHAR, faction_id VARCHAR, claimed_at,
previous_faction_id VARCHAR, previous_claimed_by VARCHAR
```

## activity_log
```
id SERIAL, type VARCHAR, actor_id VARCHAR, place_id VARCHAR, faction_id VARCHAR,
data JSONB, created_at TIMESTAMPTZ
```

## chat_messages
```
id BIGSERIAL, channel VARCHAR, user_id VARCHAR, user_name VARCHAR,
faction_id VARCHAR, faction_color VARCHAR, faction_pattern TEXT, content TEXT, created_at
```

## construction_types
```
level INT, name TEXT, description TEXT, image_url TEXT, cost INT, conquest_bonus INT, tag_ids TEXT[]
```

## territory_name_proposals / territory_name_votes
```
proposals: id UUID PK, anchor_place_id VARCHAR, proposed_by VARCHAR, name VARCHAR
votes: id UUID PK, proposal_id UUID FK, voter_id VARCHAR, value SMALLINT (+1/-1)
```

## territory_tiers
```
id SERIAL, min_places INT, title VARCHAR
```

## app_settings
```
key TEXT PK, value TEXT, updated_at TIMESTAMPTZ
```
Clés : underdog_enabled, underdog_multiplier, zone_fort_multiplier, zone_detection_radius_km, distance_gps_km, distance_close_km, distance_mid_km, distance_mult_gps/close/mid/far, energy_base_cycle, glory_discover, glory_claim, glory_fortify, glory_cost_bonus_pct

## ad_screens / ad_tips
```
screens: id SERIAL, image_url TEXT, product_url TEXT, title TEXT, active BOOLEAN
tips: id SERIAL, title TEXT, subtitle TEXT, tag VARCHAR, active BOOLEAN
```

## Tables legacy (ne pas toucher)
`image_media`, `member_codes`, `password_resets`, `refresh_tokens`, `mikro_orm_migrations`, `reviews`, `reviews_images`, `tag_gauge_mapping`

## Storage Buckets

| Bucket | Contenu |
|--------|---------|
| `place-images` | Avatars joueurs + photos de lieux |
| `community-photos` | Soumissions hub |
| `app-assets` | Icônes globales |
| `tag-icons` | Icônes de tags |
| `faction-patterns` | Patterns héritages |
| `app-fragments` | Images fragments (icon-X.webp, ability-X.png) |
