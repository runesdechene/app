# 007 — Une DA fixée, sans élément sauvage

**Date :** 2026-09-27 · **Statut :** adoptée

## Contexte
Uriel veut une vraie direction artistique fixée : titres, sous-titres, polices, couleurs. Dans
la V1, chaque composant choisissait sa taille, sa couleur et son espacement ; l'identité se
diluait écran par écran. Le Figma de la V2 n'a aucune variable : aucune échelle n'existe encore.

## Décision
- Toutes les valeurs visuelles vivent dans `shared/styles/tokens.css`, et nulle part ailleurs.
- Des styles de texte nommés (Titre d'écran, Titre de section, Sous-titre, Corps, Légende,
  Libellé, Bouton), portés par la brique `Text`.
- Les briques d'interface vivent dans `shared/ui/`.
- Stylelint refuse toute valeur visuelle en dur hors `tokens.css` ; ESLint refuse le `style`
  inline sauf variable CSS.
- La page `/v2/da` montre tout ; un test échoue si une brique de `shared/ui/` n'y figure pas.
- L'échelle est relevée dans les maquettes, proposée, puis validée par Uriel sur `/v2/da`.

## Écarté
- **Des conventions écrites sans outil** — c'est ce qui a laissé la V1 dériver.
- **Figma comme source de vérité des valeurs** — il n'a pas de variables ; la page `/v2/da` est
  le lieu de validation, le code est la source.

## Conséquences
- Ajouter une couleur ou une taille = modifier `tokens.css` et la page, visiblement.
- Une brique hors du guide casse la CI.

## Validation (27/09/2026)
Uriel a validé le relevé : la maquette Figma fait foi contre la spec V2 §5 (fond `#fcf3e4`, encre
`#494841`, accent `#a94842`, ocre `#a89369`), Cabin Condensed est la troisième police, le texte
tient en 4 niveaux, l'écran « Connexion » du Figma est une ébauche ancienne.

## L'esprit, en cinq mots (Uriel, 27/09/2026)
**Plat, parcheminé, aventure, doux — Runes de Chêne.** Toute évolution de la DA se juge contre
l'ambiance des maquettes, pas seulement leurs valeurs. L'échelle de texte de la maquette prime
sur la règle V1 « jamais sous 15 px » (`.claude/rules/interface.md`), qui ne vaut que pour la V1.
