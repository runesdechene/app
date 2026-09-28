# Ajouter un lieu — plan de la nuit du 29/09

> Maquette validée par Uriel (Figma « Ajouter un lieu — proposition (29/09) », écrans 288:147,
> 288:178, 291:146, 291:209, 293:146, 293:165, 294:146, 294:244, note 294:249). Décision au
> `_État.md` (Tranché, 29/09). Exécuté en autonomie la nuit du 29 au 30/09 : Uriel applique les
> migrations au réveil (`npx supabase db push --linked`).

## Principe

La fiche se construit sous tes yeux : photo → où → nom, nature, époque → récit → aperçu → fête.
Plein écran sur téléphone, fenêtre centrale sur PC. Brouillon enregistré à chaque geste, repris
depuis la feuille « Ajouter ». Chaque étape a son adresse ; le retour du navigateur ramène à
l'étape d'avant. La photo se sépare du parchemin par la lisière, jamais un dégradé.

## Choix faits seul (à relire au réveil)

- Gardé : les **3 découvertes** exigées par la V1 (`_require_min_discoveries`), vérifiées en base.
- Point d'intérêt et pin GPS : **toujours désactivés** (plus tard, même parcours).
- Expérience : les déclencheurs existants (+7 lieu, +1 découverte, +3 si sur place) — rien
  d'inventé. « Sur place » = à 200 m au plus, le rayon de la visite V2 (`visiter_lieu`).
- Pas de veille, de Compagnie ni de Gloire V1 (`_create_place_internal` n'est pas repris).
- Le viseur : le web ouvre l'appareil photo du téléphone (`capture`), pas de flux vidéo maison.
- Adresse et recherche : Nominatim (OpenStreetMap), comme la V1.

## Tâches

1. **Base — migration 381** : `natures_de_lieu()`, `epoques()`, `lieux_voisins(lat, lng)`,
   `ajouter_lieu(...)` (auth.uid(), 3 découvertes, photos du dossier du compte seulement, jusqu'à
   trois natures, rend le rang et l'expérience comme `decouvrir_lieu`). Test en transaction
   annulée.
2. **Données** (zone `features/ajout/`) : appels, lecture, compression des photos (WebP 1920 /
   400), position de la photo (EXIF), adresse (Nominatim), brouillon (IndexedDB).
3. **Adresses et coquille** : `/<onglet>/ajouter/lieu/<étape>` ; plein écran / fenêtre centrale ;
   quitter (garder / jeter le brouillon) ; la feuille « Ajouter » ouvre le parcours et propose de
   reprendre le brouillon.
4. **Les écrans** : photo, où (carte, épingle-photo, recherche, voisins), nom-nature-époque,
   récit, aperçu, fête.
5. **Vérifier** : tests, typecheck, lint, build ; parcours dans le navigateur jusqu'à l'aperçu
   (sans publier en prod) ; commit à chaque étape, push.
