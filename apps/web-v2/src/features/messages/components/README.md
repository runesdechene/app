# components — l'affichage de la zone Messages

Les composants visibles de la zone, chacun avec son `.module.css`. Ils n'appellent jamais
Supabase (ESLint le refuse) : les données arrivent par `../hooks/`, qui passe par `../api/`.

- `MessagesScreen` — les deux onglets : La communauté, Les Murmures.
- `Registre` — les canaux à cocher, les messages, la barre pour écrire.
- `ListeMurmures` — les correspondants, le sceau sur ce qui n'est pas lu.
- `Conversation` — une conversation de Murmures, sans bulles.
- `BarreEcrire` — la barre pour écrire, partagée par le Registre et les Murmures.
- `ChoixCanal` — le choix du canal où l'on écrit (un select maison, à la couleur du canal).
- `ListeMentions` — les Explorateurs à mentionner quand on tape « @ ».
- `Menu.module.css` — le style commun des deux menus.
