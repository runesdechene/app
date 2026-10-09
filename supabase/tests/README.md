# tests — les vérifications de la base, en transaction annulée

Chaque fichier ouvre `BEGIN`, joue une ou plusieurs migrations, vérifie, puis finit par
`RAISE EXCEPTION 'BILAN …'` et `ROLLBACK` : **rien n'est jamais conservé**. On lit le bilan dans
le message d'erreur.

Rejouer : `psql` (les `\ir` fonctionnent), ou concaténer les fichiers et passer par
`pnpm dlx supabase db query --linked -f <fichier>`.
