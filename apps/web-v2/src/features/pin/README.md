# pin — poser sa position sur place, compléter le lieu plus tard

Conception : `docs/superpowers/specs/2026-10-06-v2-pin-gps-design.md` (maquettes Figma « Pin GPS »).

Un pin naît dans le téléphone (`lib/pinsEnAttente.ts`, IndexedDB) et part au serveur dès que le
réseau le permet (`lib/envoyer.ts`) : son id et sa date viennent du téléphone. Il vaut 15 jours
(`lib/validite.ts`). Le compléter ouvre le parcours d'ajout (`features/ajout`), dont le brouillon
retient le pin.

- `api/` — `poser_pin`, `mes_pins`, `lieux_pres_du_pin`, `visiter_depuis_pin` (migrations 427-428).
- `hooks/` — le cache des pins (serveur + en attente), l'envoi automatique, les gestes.
- `components/` — poser, « Tes pins », la petite carte d'un pin, « C'est l'un de ceux-là ? ».
