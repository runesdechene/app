`/soumettre-contenu` : un joueur envoie ses photos et vidéos en tenue Runes de Chêne, sans compte. Il y arrive par un QR imprimé, ou par le lien d'une mission (`?quete=<slug>`, qui présélectionne la mission).

- Le design est celui de la page en ligne (ancien `apps/hub/src/components/StudioSubmit`), gardé par Uriel le 15/10. Sur PC, une carte à deux panneaux est posée sur la photo du réglage Studio (`get_studio_config`). Au téléphone, il n'y a que le formulaire, en plein écran.
- `PageSoumettre` : l'état du formulaire et l'étape, lue dans l'adresse (`?etape=2`). Une étape tapée à la main n'ouvre jamais plus loin que ce qui est rempli.
- Une étape par fichier : `EtapeContenus`, `EtapeTailles`, `EtapeHistoire` et `EtapeToi`. Leurs pièces communes sont dans `Etape`, la frise dans `Frise`, la carte de fin dans `Succes`.
- `useEnvoi` : les fichiers partent un par un (compressés en WebP), puis `deposer_contenu` enregistre l'envoi (mig 501). Si aucun fichier ne part, rien n'est enregistré.
- `api.ts` : tout ce qui parle à Supabase. Le visiteur ne lit que des phrases écrites pour lui, jamais le texte du serveur.
- `lib/` : les règles sans React, c'est-à-dire les fichiers acceptés, la compression, les départements et les verrous du formulaire.
