---
paths:
  - "apps/hub-v2/**"
---

# Le Hub — back-office

> Conventions propres au back-office (`apps/hub-v2`, hub.runesdechene.com depuis le 16/10/2026).
> Le Hub pousse vers la boutique : une régression ici se voit en ligne.

## Tout écran du Hub se conçoit, il ne se copie pas

Tout nouvel écran du Hub (`apps/hub-v2`) se conçoit, il ne se copie pas. Charger
`frontend-design` avant d'écrire le composant, au même titre que pour la boutique.

**Why :** j'ai livré l'écran « Fragments audio » en copiant `ShopifyUnlocks.tsx` —
`<table>` nu, classes `page` et `couverture` sans aucun style. La revue l'avait
signalé, je l'avais classé mineur et différé. Uriel a repris là-dessus le
2026-08-16 : « pourquoi tu oublies continuellement de faire du design lorsqu'on
travaille sur le hub ». Le raisonnement fautif était « un back-office n'a pas
besoin d'être beau » — or c'est l'écran qu'il consulte tous les jours, et sa marque
a une identité forte qu'il remarque quand elle manque.

**How to apply :** le Hub V2 (`apps/hub-v2`) n'a pas de DA à lui : il prend celle de l'appli,
dans `packages/da` (`tokens.css`), et les briques de `apps/hub-v2/src/shared/ui/`. Un écran se
compare à sa maquette Figma (section « Hub V2 — maquette (14/10) ») à 1440 et 390 px avant d'être
dit fini.

Voir aussi [[sonde-avant-hypotheses]].

## Un bouton du Hub passe par la brique `Bouton`, jamais par le style du fichier voisin

**Le piège** (20/10/2026, retrait des photos d'un lieu) : le Hub n'avait pas de brique bouton. J'ai
posé le `boutonContour` de la communauté sous des vignettes de 96 px, puis recopié les liens
soulignés rouges de « Photos et avis ». Uriel : « les liens soulignés en rouge c'est pas vraiment
stylisé », et le Hub en a « PLEIN » de ce genre.

**How to apply :** tout bouton du Hub est `shared/ui/Bouton` (principal, secondaire, doux,
discret : les sortes du `Button` de l'appli, mêmes jetons). Un style trouvé dans un écran voisin
n'est pas une référence : la référence, c'est l'appli (`apps/web-v2/src/shared/ui`) et la maquette.
Regarder le rendu (capture) avant de dire fini.
