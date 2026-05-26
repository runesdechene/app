# UGC « Le Mouvement » — Modèle de fond

> Spec de **vision** (pas d'implémentation). Date : 2026-05-26.
> Objet : transformer la communauté Runes de Chêne en moteur d'UGC durable —
> collecte, récompense, exploitation, et à terme programme Ambassadeur + Quêtes.
> Cadre les chantiers d'implémentation suivants (un plan par brique).

---

## 1. Problème & intention

Runes de Chêne veut **exploiter sincèrement sa communauté pour produire de l'UGC**
(photos, vidéos, avis sur « comment je vis le Mouvement ») et le réutiliser
(boutique, réseaux, appli), tout en **récompensant** les contributeurs et en faisant
émerger des **Ambassadeurs**.

### État des lieux (mai 2026)

| Couche | État | Détail |
|--------|------|--------|
| **Collecte** | ✅ solide | Formulaires publics boutique : `PhotoSubmit.tsx` (`/soumettre-contenu`), `ReviewSubmit.tsx` (`/soumettre-avis`). Champs riches (rôle client/ambassadeur/partenaire, taille produit, modèle, message, note…), consentements diffusion + liaison compte. **Créent déjà un compte** via `create_user_from_submission`. |
| **Modération** | ✅ mature | `Photos.tsx` / `Reviews.tsx` (hub) : workflow `pending → approved → archived`, tags, édition message + `product_worn`, download ZIP, lightbox. RPC `moderate_submission` / `moderate_review`. |
| **Exploitation / affichage** | 🔴 cassé | Mur boutique « Ils nous portent » désactivé (bug avril 2026). **Aucune RPC publique** ne sert l'approuvé : le contenu dort en DB. |
| **Récompense** | ❌ inexistant | Contribuer ne rapporte rien — l'écran de fin dit juste « ton compte existe ». |
| **Quêtes / Ambassadeurs** | ❌ inexistant | Le rôle « ambassadeur » est une étiquette manuelle, sans programme ni progression. |

### Le trou central
On **collecte et modère très bien**, mais (a) l'approuvé ne ressort nulle part de façon
automatisée, et (b) contribuer ne récompense rien. Le formulaire boutique **crée déjà un
compte** silencieusement : c'est un **tunnel client → joueur déguisé**, aujourd'hui gâché
faute de carotte.

---

## 2. Décisions d'architecture (arbitrées avec Uriel)

### D1 — Modèle à trois loci (validé)
On ne traite pas « l'UGC » comme un bloc. Trois loci, trois réponses :

1. **Collecte** → **multi-canal**, reste distribuée. Le formulaire boutique sans friction
   capte le **client pur** (acheteur qui ne joue pas) ; le forcer dans l'appli amputerait
   le plus gros gisement d'UGC authentique. En Phase 2, les Quêtes in-app deviennent une
   seconde bouche de collecte.
2. **Récompense + identité + statut** → **centralisés dans l'appli**, par nécessité :
   Couronnes, bonus, titres, rang Ambassadeur n'ont de sens que dans l'appli.
3. **Affichage / exploitation** → **double (et plus) sortie** : boutique + appli + réseaux.

**Insight directeur** : le compte auto-créé à la soumission fait du formulaire un tunnel
client → joueur. Le modèle l'arme : *« Ta contribution t'a fait gagner X Couronnes —
récupère-les sur La Carte. »* C'est la contribution elle-même qui tire le client vers le jeu.

### D2 — Récompense en échelle à paliers (validé)
Le virtuel quasi-gratuit (Couronnes) récompense le **volume** ; le **réel** (réducs,
produits) est réservé au **statut Ambassadeur**. Protège la marge, récompense la régularité,
crée une progression désirable.

### D3 — Devise : Couronnes + compteur `Contributions` dédié — **PAS la Gloire** (validé)
- **Couronnes** (économie spendable, mig 021) : la devise de récompense.
- **Compteur `Contributions`** (net-new) : alimente badges / paliers / piste Ambassadeur.
- **Gloire exclue de la boucle.** Raison (mig 024, barème *« validé Uriel 2 mai, anti-triche »*) :
  la Gloire est un **score de compétition** (même formule que la Coupe, alimente le classement),
  bâti sur un barème d'actions **vérifiées en jeu**. Créditer de la Gloire pour une soumission
  boutique (a) laisserait un non-joueur grimper au classement, (b) violerait le principe
  anti-triche, (c) rouvrirait un vecteur de farm. **La Gloire reste sacrée : l'effort en jeu.**
  Le contributeur a sa propre échelle (`Contributions`).

### D4 — Récompense déclenchée à la VALIDATION, jamais à l'envoi (validé)
L'acte de modération (`moderate_submission`) est le déclencheur de récompense. Anti-farm natif :
on ne récompense que le contenu qu'on garde.

### D5 — Timing : bonus de bienvenue unique + reste à la validation (validé)
- **Bonus de bienvenue UNIQUE par compte**, instantané (à la **création** du compte, pas par
  soumission). Donne à l'écran de fin sa gratification immédiate **sans être farmable** :
  balancer 50 photos n'en donne pas plus.
- **Récompense par contribution** (Couronnes + `Contributions++`) livrée **à la validation**,
  par **email d'acceptation**.

### D6 — Canal de notification : email primaire, push secondaire (validé)
- **Email = universel.** On a l'email (clé du compte). L'email d'acceptation **EST le CTA de
  conversion**, envoyé au meilleur moment. Atteint le client pur qui n'a pas l'appli.
- **Push** (`push_subscriptions`, mig 141) : bonus pour le joueur déjà installé uniquement —
  un contributeur boutique frais n'a pas d'abonnement push.

### D7 — Ambassadeur : curaté, downstream (validé)
Pas d'auto-promotion. Le rang se **mérite et s'accorde** par Uriel, alimenté par (a) le volume
du compteur `Contributions` et (b) des **coups de cœur** admin (signal plus fort que « approuvé »).
Le réel (réducs, produits) se débloque ici. Protège la marque et désamorce la ferme à UGC.

### D8 — Le « claim » n'est pas une mécanique nouvelle
Le compte est déjà semé ; les Couronnes sont créditées dessus à la validation. L'utilisateur les
« récupère » simplement **en se connectant à l'appli** (magic-link déjà en place,
`signInWithMagicLink`). Aucun système de claim à construire.

---

## 3. La boucle

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                          ▼
CONTRIBUE                                          [ Couronnes + ↑compteur Contributions ]
(boutique OU appli)                                           │
   │                                                          ▼
   ├─► compte créé/confirmé (email) ──► CTA SEXY ──► "claim" = login appli
   │      └─ bonus de bienvenue UNIQUE (instant)              │
   ▼                                                          ▼
MODÉRATION (hub) ──approuvé──► RÉCOMPENSE (email) ──► profil joueur grandit
   │         └─coup de cœur─► piste AMBASSADEUR (curaté)      │
   ▼                                                          │
APPROUVÉ ─► surfaces d'affichage ◄────────────────────────────┘
   (fiches produit · mur · galerie in-app · réseaux)
```

---

## 4. Les couches

### Couche A — Collecte (multi-canal, sans friction)
- **Canal 1 (existant)** : formulaires boutique. Phase 1 = glow-up + **écran de fin qui vend**.
- **Canal 2 (Phase 2)** : Quêtes in-app (prompts thématiques).
- Le pipeline DB (`hub_photo_submissions`, `hub_submission_images`, `hub_review_submissions`,
  bucket `community-photos`) et les consentements sont réutilisés tels quels.

### Couche B — Récompense & identité (cœur de Phase 1)
- Déclencheur = validation (D4). Devise = Couronnes + `Contributions` (D3). Timing = D5. Canal = D6.
- **Point de vigilance implémentation** : le cap journalier de Couronnes (mig 029) vise le jeu ;
  la récompense UGC doit vivre dans un **bucket / chemin séparé** pour ne pas être bloquée par le cap.
- **Écran de fin (principe + copy de référence)** :
  > « Bienvenue dans le Mouvement. Ton compte La Carte est créé (+X Couronnes offertes).
  > Ton contenu part en validation — dès qu'il est adoubé, tes Couronnes de Chêne y atterrissent,
  > on te prévient. » + bouton « Découvrir La Carte ».
  Le **mockup visuel sexy** sera conçu à l'implémentation de la Brique 1 (frontend-design).

### Couche C — Exploitation (surfaces, priorisées)
Toutes nécessitent une **brique commune manquante** : une **RPC publique read-only de l'approuvé**
(n'existe pas aujourd'hui — c'est elle qui réveille le contenu dormant).

1. **Fiches produit boutique** 🥇 — galerie « porté par la communauté » via `product_worn`
   (déjà capturé). ROI commercial maximal.
2. **Réseaux / repost marque** 🥈 — vivier Instagram ; l'outil ZIP du hub existe déjà. Gain quasi
   zéro-dev.
3. **Mur « Ils nous portent »** 🥉 — reconstruction propre du mur cassé.
4. **Galerie communauté in-app** — vie de la communauté ; se marie avec les Quêtes (Phase 2).

### Couche D — Ambassadeur (curaté, downstream)
- Alimenté par volume `Contributions` + coups de cœur admin (D7).
- Nouveau signal admin **« coup de cœur »** (plus fort que « approuvé ») à ajouter à la modération.
- Débloque le **réel** (réducs, produits). Entrée accordée par Uriel uniquement.

### Phase 2 — Quêtes UGC (esquisse, hors périmètre de ce spec)
Briques prêtes (compte, récompense, modération) → on ajoute des **prompts thématiques** in-app :
*« shooting près d'une église pour tel motif »* → soumission rattachée à la quête → même pipeline
validation/récompense + bonus de quête.

---

## 5. Séquence de construction recommandée

| Brique | Contenu | Pourquoi cet ordre |
|--------|---------|--------------------|
| **1** | Boucle récompense (bonus bienvenue + crédit à la validation + email) + glow-up formulaire + CTA sexy + compteur `Contributions` au profil | Comble le trou d'incitation, arme le tunnel client→joueur. Tout le reste en dépend. |
| **2** | RPC publique lecture de l'approuvé + galeries fiches produit + repost réseaux | Réveille le contenu dormant ; ROI commercial immédiat ; repost quasi zéro-dev. |
| **3** | Mur « Ils nous portent » reconstruit + galerie communauté in-app | Vitrine + boucle d'engagement joueur. |
| **4** | Programme Ambassadeur formalisé (signal coup de cœur, paliers, perks réels), puis Quêtes (Phase 2) | Se posent sur des fondations éprouvées. |

**Alternative écartée** — « affichage d'abord » (refaire le mur avant la boucle) : récompense la
marque avant le contributeur sans corriger le trou d'incitation, qui est le vrai point de départ.

---

## 6. Existant vs net-new (ancrage code)

**Réutilisé tel quel** : formulaires boutique, pipeline DB submissions/images, modération hub,
auto-création de compte (`create_user_from_submission`), magic-link, économie Couronnes (mig 021,
voir aussi `2026-05-07-couronnes-economie-progressive-design.md`), outil ZIP.

**Net-new (à concevoir dans les plans par brique)** :
- Compteur `Contributions` (colonne/table + incrément à la validation).
- Crédit Couronnes à la validation (bucket séparé du cap mig 029) + bonus de bienvenue unique.
- Email d'acceptation (canal + template + lien de conversion).
- RPC publique read-only de l'approuvé (clé des surfaces d'affichage).
- Galeries fiches produit (boutique, via `product_worn`).
- Signal admin « coup de cœur » dans la modération.
- Glow-up écran de fin / CTA.

---

## 7. Hors périmètre (non tranché, à traiter en temps voulu)
- Barème exact (combien de Couronnes par contribution ? pondération photo/vidéo/avis ?).
- Seuils des paliers et table des perks Ambassadeur.
- Design pixel du CTA et des galeries (frontend-design, à l'implémentation).
- Mécanique détaillée des Quêtes (Phase 2, spec dédié).
