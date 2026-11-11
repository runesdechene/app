`/soumettre-contenu` : un client partage un avis, sans compte. Le premier écran (`ChoixDuChemin`) fait choisir entre « Un avis avec photos » (`?chemin=photos`, ses photos et vidéos en tenue Runes de Chêne) et « Un avis seul » (`?chemin=avis`, quelques étoiles et un mot). Le lien d'une mission (`?quete=<slug>`) ouvre directement les photos et présélectionne la mission.

- Le design est celui de la page en ligne (l'ancien `StudioSubmit` du Hub V1, retiré le 16/10), gardé par Uriel le 15/10. Sur PC, une carte à deux panneaux est posée sur la photo du réglage Studio (`get_studio_config`). Au téléphone, il n'y a que le formulaire, en plein écran.
- `PageSoumettre` : l'état du formulaire, le chemin et l'étape, lus dans l'adresse (`?chemin=avis&etape=2`). Une étape tapée à la main n'ouvre jamais plus loin que ce qui est rempli.
- Une étape par fichier : `EtapeContenus`, `EtapeTailles`, `EtapeHistoire` et `EtapeToi` avec photos ; `EtapeAvis` puis `EtapeToi` pour un avis seul. Leurs pièces communes sont dans `Etape`, les étoiles dans `Etoiles`, les pastilles (tailles, vêtement) dans `Pastille` et `ChoixDuVetement`, la frise dans `Frise`, la carte de fin dans `Succes`.
- Un avis seul (`deposer_contenu` sans image, mig 588) ne crée pas de compte. Le lien de l'e-mail de demande d'avis peut pré-remplir : `?chemin=avis&email=…&type=tshirt|sweatshirt|veste_zip`.
- `useEnvoi` : les fichiers partent un par un (compressés en WebP), puis `deposer_contenu` enregistre l'envoi (mig 501). Si aucun fichier ne part, rien n'est enregistré.
- `api.ts` : tout ce qui parle à Supabase. Le visiteur ne lit que des phrases écrites pour lui, jamais le texte du serveur.
- `lib/` : les règles sans React, c'est-à-dire les fichiers acceptés, la compression, les départements et les verrous du formulaire.
