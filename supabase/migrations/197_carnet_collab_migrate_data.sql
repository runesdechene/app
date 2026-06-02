-- 197_carnet_collab_migrate_data.sql
-- WHY : convertir les carnets V0.5 vers le modèle collaboratif.
-- Idempotence : ne s'exécute que s'il reste des lignes type='carnet'.

BEGIN;

-- 1) Pour chaque lieu ayant des carnets, choisir le carnet-seed.
WITH authored AS (
  SELECT pd.place_id, pd.user_id AS author_id
  FROM places_discovered pd WHERE pd.method = 'author'
),
ranked AS (
  SELECT pc.id, pc.place_id, pc.user_id, pc.content, pc.created_at,
         ROW_NUMBER() OVER (
           PARTITION BY pc.place_id
           ORDER BY (CASE WHEN a.author_id = pc.user_id THEN 0 ELSE 1 END),
                    pc.votes_up DESC, pc.created_at ASC
         ) AS rn
  FROM place_contributions pc
  LEFT JOIN authored a ON a.place_id = pc.place_id
  WHERE pc.type = 'carnet'
)
-- 2) Le carnet-seed (rn=1) devient la description + une révision initiale.
, seeds AS (
  SELECT id, place_id, user_id, content, created_at FROM ranked WHERE rn = 1
    AND NULLIF(TRIM(content),'') IS NOT NULL
)
INSERT INTO place_description_revisions (place_id, content, edited_by, created_at)
SELECT place_id, content, user_id, created_at FROM seeds;

-- 3) Convertir les lignes seed en type 'description'
UPDATE place_contributions pc SET type = 'description', updated_at = now()
FROM (
  SELECT r.id FROM (
    SELECT pc.id, ROW_NUMBER() OVER (
      PARTITION BY pc.place_id
      ORDER BY (CASE WHEN a.author_id = pc.user_id THEN 0 ELSE 1 END), pc.votes_up DESC, pc.created_at ASC
    ) AS rn
    FROM place_contributions pc
    LEFT JOIN (SELECT place_id, user_id AS author_id FROM places_discovered WHERE method='author') a
      ON a.place_id = pc.place_id
    WHERE pc.type = 'carnet' AND NULLIF(TRIM(pc.content),'') IS NOT NULL
  ) r WHERE r.rn = 1
) s
WHERE pc.id = s.id;

-- 4) Tous les autres carnets restants deviennent des commentaires.
UPDATE place_contributions SET type = 'comment', updated_at = now()
WHERE type = 'carnet';

COMMIT;
