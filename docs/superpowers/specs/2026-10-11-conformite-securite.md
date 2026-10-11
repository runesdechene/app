# Conformité et sécurité — Explore (design)

> Demandé par Uriel le 11/10/2026 : « On doit être irréprochable pour la loi française. »
> Décisions d'Uriel du 11/10 (vault, `_État.md`, Tranché) ; les textes légaux sont des projets à
> faire relire par une personne compétente avant publication.

## Déjà fait (11/10)

- **Mig 489** — faille critique : l'écriture de `titles`, `user_fragments`, `shopify_unlocks`,
  `title_fragments`, `fragment_words`, `faction_tag_bonuses`, `fragment_tag_affinities`, `tags`
  était ouverte à la clé publique (politiques « Service role can manage … » écrites pour
  `public` avec `true`) ; `Public can create user accounts` permettait de se fabriquer un admin
  via `handle_new_user`. Écriture réservée à `_is_admin()`. Test : `supabase/tests/securite/489_*`.
- **Mig 490** — deux comptes perdent le rôle admin (Uriel). Restent : Tugdual, Uriel, Mathéo, Gautier.
- **Mig 491** — colonnes privées de `users` fermées à la lecture des rôles publics ; TRUNCATE retiré.
- **Mig 492** — `tag-icons`, `app-assets`, `faction-patterns` : écriture réservée à l'équipe.
- **Mig 493** — les 2 460 empreintes de mots de passe de la V1 effacées (colonne au registre de purge).
- **Mig 494** — sans compte, 20 fonctions publiques au lieu de 250 ; les fonctions à venir naissent fermées à anon.
- **Mig 495** — `search_path` figé sur les 112 SECURITY DEFINER qui n'en avaient pas.
- Règles : `.claude/rules/supabase.md` ; tests : `supabase/tests/securite/`.
- **Mig 496-497, Pythéas 1.21.0** — « Tes données » dans les Préférences : supprimer son compte (pierre tombale « Un Voyageur », compte de connexion supprimé, chefferie transmise), télécharger ses données (JSON).
- **Mig 498, Pythéas 1.22.0** — textes légaux `/legal/*`, accord à l'inscription, fenêtre « Nos conditions évoluent ».
- **Mig 499** — « Changer le rôle » du Hub passe par `changer_role` (admins seulement).
- **Mig 500** — le mur photos de la boutique ne rend plus Instagram, ville ni code postal.
- **Mig 501** — le Studio (`/soumettre-contenu`), cassé depuis la 347, dépose par `deposer_contenu` ;
  les trois anciennes fonctions sont fermées à anon.

## 1. Sécurité — à faire

1–5. Faits (migs 491-495, ci-dessus).
6. Fait (mig 500).
7. **Le Hub** : « Réinitialiser le tutoriel » écrit `users` en direct, que la RLS refuse sans
   erreur. Bouton de la V1 : à retirer (« Changer le rôle » : fait, mig 499).
8. **Réglages Auth** (tableau de bord, Uriel) : protection des mots de passe divulgués, limites
   de débit, durée des sessions.

## 2. RGPD — dans l'appli

1. **Supprimer mon compte** (Préférences) : confirmation par le code e-mail. Effacés : e-mail,
   nom, photo de profil, présentation, Instagram, position, abonnements push, envies, visites,
   cœurs, notifications, Murmures, compte d'authentification. Restent, signés « Un Voyageur » :
   lieux, photos, récits, mots des carnets et des Compagnies. Chef d'une Compagnie : la
   chefferie passe au plus ancien Officier (ou la Compagnie est dissoute, à trancher au code).
2. **Télécharger mes données** (Préférences) : un fichier JSON de tout ce qui le concerne.
3. **Consentement à l'inscription** : la Charte devient « Charte et conditions » avec les liens
   vers les conditions et la politique de confidentialité ; date d'acceptation gardée.
4. **Polices hébergées par nous** (appli, fiches, Hub) : plus de Google Fonts, qui transmet
   l'adresse IP à Google sans consentement.
5. **Signaler un contenu** : existe pour les lieux et les énigmes ; à vérifier pour les mots
   publics, les photos et les profils (LCEN, DSA : un moyen simple de signaler).

## 3. Textes légaux — pages publiques de l'appli

`/legal/mentions`, `/legal/confidentialite`, `/legal/conditions`, liés depuis le bas de page
de la vitrine et des fiches, l'inscription et les Préférences.

- **Mentions légales** (LCEN art. 6) : éditeur (Lahoussaye EI, SIRET, adresse, contact,
  directeur de la publication), hébergeurs (Netlify ; Supabase, Irlande).
- **Politique de confidentialité** (RGPD art. 13) : responsable ; données (e-mail, nom, photo,
  position facultative, photos et textes publiés, messages, abonnements push, appareil) ;
  finalités et bases légales ; durées ; destinataires et sous-traitants (Supabase, Netlify,
  Resend, Shopify, services push Google / Apple / Mozilla, OpenFreeMap, Esri, Nominatim) ;
  transferts hors UE et garanties ; droits (accès, rectification, effacement, portabilité,
  opposition) et comment les exercer ; réclamation CNIL ; âge minimum (15 ans, sinon accord
  parental) ; cookies (aucun traceur, stockage local strictement nécessaire).
- **Conditions d'utilisation** : objet, inscription, gratuité, la Charte (règles de conduite),
  contenus publiés (licence accordée, responsabilité, modération et signalement), propriété
  intellectuelle, suspension par l'équipe, responsabilité (sorties sur le terrain : prudence,
  propriétés privées, sites protégés), droit applicable.

## Ordre

Sécurité 1 → 5, puis la suppression de compte, l'export, les polices, les textes et le
consentement, puis la vérification du signalement.
