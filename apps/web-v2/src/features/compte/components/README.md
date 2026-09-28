# components — les écrans de la zone Compte

- `CompteScreen` — l'onglet Compte : mes badges, mon profil, Préférences, Déconnexion.
- `ProfilExplorateur` — le profil public ; ses états chargement / erreur / introuvable.
  - `ProfilEntete` — couverture du signe, portrait, nom, niveau, titres en une ligne (origine
    au toucher), présentation, attache, bouton.
  - `ProfilChiffres` — le bandeau : lieux ajoutés, visités, fragments.
  - `ProfilFragments` — les Fragments collectés sur une ligne ; sur son profil, choisir son
    signe et « + N à découvrir » vers la boutique.
  - `ProfilDecouvertes` — sections Lieux ajoutés / Visités / Envie d'y aller, en lignes qui défilent.
  - `ExplorateurIntrouvable` — l'adresse d'un Explorateur qui n'existe pas.
- `ModifierProfil` — le formulaire du profil ; ne s'affiche qu'une fois tout chargé.
- `PreferencesPage` — les trois cartes de réglages.
- `BadgesExplorateur` — « Client Runes de Chêne » et le rôle, à droite du titre du détail.
