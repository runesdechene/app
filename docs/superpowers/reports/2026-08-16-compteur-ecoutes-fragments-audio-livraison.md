# Compteur d'écoutes des Fragments audio — livraison

> 2026-08-16 · Branche `feat/fragments-audio-metrics` sur **les deux dépôts** (monorepo + thème Shopify).
> Non fusionnée dans `main`. Spec : `docs/superpowers/specs/2026-08-14-compteur-ecoutes-fragments-audio-design.md`

## Ce qui est en place

**Base de données — DÉJÀ APPLIQUÉE EN PRODUCTION.** Les migrations 340, 341 et 342 sont poussées et vérifiées.
Elles ne dépendent pas de la fusion de la branche.

- `fragment_audio_plays` — table verrouillée : RLS activée et forcée, zéro policy, privilèges révoqués à
  `anon` et `authenticated`. Aucun accès direct possible. Vérifié en conditions réelles : une lecture en clé
  anon renvoie 401.
- `log_fragment_audio_play(...)` — écriture, exposée à `anon`. Ne lève jamais d'erreur, même sur entrée
  malformée. Une ligne par (session, Illustration, surface, jour) ; les envois successifs s'écrasent et ne
  peuvent que faire monter les valeurs.
- `get_fragment_audio_stats()` — lecture, réservée au staff via `_is_staff()`. `EXECUTE` révoqué à `public`
  et `anon` avant d'être accordé à `authenticated`.

**Thème Shopify** (`feat/fragments-audio-metrics`, non déployé) :
- `snippets/fragment-audio.liquid` — le lecteur et sa mesure, en un seul endroit.
- `sections/rdc_motif.liquid` — la page motif appelle le snippet (`source: 'motif'`).
- `sections/lecture-fragment-v2.liquid` — la fiche produit aussi (`source: 'produit'`).

**Hub** (`feat/fragments-audio-metrics`, non déployé) :
- Écran `/shopify/fragments-audio` : tableau trié par taux de complétion, plus un bandeau de couverture.

## Ce que la mesure compte, exactement

Une écoute est comptée quand le visiteur a **réellement joué** `min(10 s, 25 % de la durée)`. Le temps joué
est accumulé à partir des écarts entre positions successives, en rejetant tout écart supérieur à 1,5 s —
c'est ce qui distingue une lecture d'un déplacement de la glissière. Une pause ne peut pas être absorbée
comme du temps joué.

Une complétion demande **90 % du temps réellement joué**. Tirer la glissière jusqu'à la fin ne produit donc
ni écoute ni complétion. C'était le défaut le plus grave trouvé en revue finale : le seuil testait au départ
la position de la tête de lecture, ce qui rendait le chiffre décisif fabricable en deux secondes.

Si le handle du métaobjet Illustration est vide, **le lecteur fonctionne mais la mesure se tait**. Il n'y a
plus de repli : un repli aurait écrit des clés différentes selon la surface, et les lignes ne se seraient
jamais jointes.

## Fait déterminant sur la valeur de tout ceci

**Sur les 22 Illustrations, une seule porte un fichier de voix off : `Hoplite`.** Les 21 autres ont le champ
`fragment_audio` vide, Avalon compris.

La mécanique est juste et mesurera correctement — mais elle mesurera **un seul Fragment**. La question que ce
chantier devait trancher (« la voix off mérite-t-elle de rester au budget de chaque drop ? ») ne peut pas
recevoir de réponse tant qu'il n'y a qu'un enregistrement en ligne. Deux lectures possibles : soit les voix
off existent et ne sont pas rattachées aux métaobjets — c'est du remplissage de champ ; soit elles n'ont
jamais été produites au-delà de Hoplite, et la vraie décision n'est pas de mesurer mais d'en enregistrer
une poignée pour avoir de quoi comparer.

## À faire

### 1. Déployer

- Thème : pousser la branche sur un **thème d'aperçu**, pas en ligne.
- Hub : déploiement Netlify **manuel**, jamais d'auto-deploy Git.

### 2. Vérifier — six relevés

⚠️ **À faire sur l'URL de la boutique ou de l'aperçu, PAS dans l'éditeur de thème.** Le script de mesure est
en ligne dans la section : l'éditeur ne le ré-exécute pas quand il redessine une section, et la mesure
paraîtrait morte alors que tout va bien.

1. **La jointure, côté produit.** Ouvrir un produit dont `illustration_produit` pointe **Hoplite** (la seule
   Illustration avec audio). Écouter jusqu'au bout. Vérifier en base que `illustration_handle` vaut
   `hoplite` et **non** le handle du produit. Ce seul relevé prouve d'un coup que `system.handle` résout,
   qu'aucun repli n'a joué, et que les deux surfaces se joindront.
   *Préalable* : s'assurer qu'au moins un produit actif pointe bien le métaobjet Hoplite. Si aucun ne le
   fait, la surface produit n'est pas testable aujourd'hui.
2. **Les deux surfaces, même session, même jour.** Écouter en entier sur la page motif de Hoplite, puis sur
   cette fiche produit. Attendu : **deux lignes**, même `illustration_handle`, même `session_id`, `source`
   valant `motif` et `produit`, `completed` vrai sur les deux.
3. **Le seuil.** Lancer, couper à 3 secondes → **aucune ligne**. Puis tirer la glissière jusqu'à la fin →
   **aucune ligne non plus**. C'est le relevé qui prouve que le chiffre n'est pas fabricable.
4. **La bascule d'onglets.** Franchir le seuil, basculer d'onglet trois ou quatre fois, revenir et finir.
   Attendu : **une seule ligne**, `completed` vrai.
5. **L'écran du Hub.** Se connecter en staff, ouvrir « Fragments audio ». Le tableau doit correspondre ligne
   pour ligne à `select * from public.get_fragment_audio_stats()`. Le bandeau doit annoncer **21
   Illustrations sans voix off**, Hoplite absent de cette liste. S'il affiche 0 ou un message de portée
   manquante, la constante de type ou la clé du champ audio est fausse.
6. **Régression visuelle sur la page motif.** Les styles du lecteur sont passés d'une portée limitée à la
   section à une portée globale. Les déclarations ont été comparées une à une en revue, mais seul un
   avant/après ferme le sujet.

## Suites identifiées, non faites

Aucune ne bloque la fusion.

- **Afficher le temps écouté moyen.** La colonne `listened_seconds` est remplie mais affichée nulle part.
  Si le taux de complétion revient à 30 %, rien ne dit si les gens décrochent à 15 % ou à 85 % — et ces
  deux réponses commandent des décisions opposées (supprimer la narration, ou la raccourcir). C'est
  l'incrément le plus utile.
- **Le tri par taux est du bruit sur petits effectifs.** Un seul auditeur qui finit place un Fragment à
  100 %. Le classement ne voudra rien dire avant des dizaines d'écoutes par Fragment.
- **Pas de fenêtre temporelle.** L'agrégat porte sur toute la durée de vie, sans vue par période. Il faudra
  un filtre de date avant le deuxième drop.
- **`sessionStorage` est par onglet.** Un second onglet ou un redémarrage du navigateur crée une nouvelle
  session, donc une seconde écoute comptée le même jour. `localStorage` tiendrait la promesse littérale de
  la spec, au prix d'un identifiant persistant — c'est un arbitrage à faire sciemment, pas un défaut à
  corriger par défaut.
- **Pas de politique de rétention** sur `fragment_audio_plays`.
- **Le tableau affiche le handle brut** (`hoplite`) là où le bandeau affiche le nom lisible.
- `read_metaobject_definitions` n'est **pas** nécessaire — ne pas l'ajouter.

## Rapports détaillés

Les rapports d'implémentation, les revues et le journal des décisions vivent dans
`.superpowers/sdd/2026-08-15-compteur-ecoutes-fragments-audio/` (ignoré par git, local à ce poste).
