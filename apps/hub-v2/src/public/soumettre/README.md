`/soumettre-contenu` : un client laisse son avis, sans compte, en trois étapes : « Ton avis » (vêtement, notes, quelques mots), « Tes photos » (facultatives, avec leurs tailles), « Toi ». Le lien d'une mission (`?quete=<slug>`) présélectionne la mission à l'étape des photos. L'ancien `?chemin=avis` reste accepté et ne change rien.

- Le design est celui de la page en ligne (l'ancien `StudioSubmit` du Hub V1, retiré le 16/10), gardé par Uriel le 15/10. Sur PC, une carte à deux panneaux est posée sur la photo du réglage Studio (`get_studio_config`). Au téléphone, il n'y a que le formulaire, en plein écran.
- `PageSoumettre` : l'état du formulaire et l'écran, lu dans l'adresse (`?etape=2`). Une étape tapée à la main n'ouvre jamais plus loin que ce qui est rempli.
- Une étape par fichier : `EtapeAvis`, `EtapeContenus` (les photos), `EtapeTailles` et `EtapeToi`. Leurs pièces communes sont dans `Etape`, les étoiles dans `Etoiles`, les pastilles (tailles, vêtement) dans `Pastille` et `ChoixDuVetement`, la frise dans `Frise`, la carte de fin dans `Succes`.
- Un avis sans photo (`deposer_contenu` sans image, mig 588) ne crée pas de compte. Le lien de l'e-mail de demande d'avis peut pré-remplir : `?email=…&type=tshirt|sweatshirt|veste_zip`.
- `useEnvoi` : les fichiers partent un par un (compressés en WebP), puis `deposer_contenu` enregistre l'envoi (mig 501). Si aucun fichier ne part, rien n'est enregistré.
- `api.ts` : tout ce qui parle à Supabase. Le visiteur ne lit que des phrases écrites pour lui, jamais le texte du serveur.
- `lib/` : les règles sans React, c'est-à-dire les fichiers acceptés, la compression, les départements et les verrous du formulaire.
