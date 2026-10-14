Fonctions pures du Hub, testées seules : `ecart` (l'écart d'une tuile), `quand` (« il y a… »).

- `dates` : `dateCourte` (« 14/10/2026 » ou « jamais ») et `moisAnnee` (« 10/2026 » ou « — »), à l’heure de Paris.
- `couleur` : `couleurValide` (un code #RRGGBB, la règle de la base).
- `texte` : `texteEnClair` (une énigme sans les accolades de ses dates, pour l’aperçu en liste) et `pluriel` (« 1 point », « 2 points »).
- `envoi` : `verifierFichier` (type et poids, avant l'envoi), `envoyerFichier` et `retirerFichier` (buckets Supabase, le chemin se déduit de l’adresse publique).
- `maplibre` : MapLibre réglé une fois (worker), et `STYLE_DE_CARTE`. Les tests le remplacent par `test/fausseCarte.ts`.
- `fonctions` : `appelerFonction` (appel d'une fonction Netlify avec le jeton de session) et `lireReponse` (le corps JSON, ou une erreur lisible : fonction absente, 403, échec Shopify relayé).
