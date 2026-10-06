# pin — poser sa position sur place, compléter le lieu plus tard

Conception : `docs/superpowers/specs/2026-10-06-v2-pin-gps-design.md` (maquettes Figma « Pin GPS »).

Un pin naît dans le téléphone (`lib/pinsEnAttente.ts`, IndexedDB) et part au serveur dès que le
réseau le permet (`lib/envoyer.ts`) : son id et sa date viennent du téléphone. Il vaut 15 jours
(`shared/lib/validitePin.ts`). Le compléter ouvre le parcours d'ajout (`features/ajout`), dont le brouillon
retient le pin. L'adresse d'un pin vient de `shared/lib/adresse.ts`.

- `api/` — `poser_pin`, `mes_pins`, `lieux_pres_du_pin`, `visiter_depuis_pin` (migrations 427-428).
- `lib/` — `pinsEnAttente` (les pins en attente, IndexedDB), `envoyer` (l'envoi au serveur),
  `heure` (« 14 h 32 », dans la liste et sur « Pin posé »).
- `hooks/` — `usePins` : le cache des pins (serveur + en attente), l'envoi automatique, les gestes.
- `components/` — `PoserPin` (poser), `TesPins` (la liste), `FichePin` (la petite carte d'un pin),
  `CestLunDeCeuxLa` (« C'est l'un de ceux-là ? »).

Sur la carte : le calque des pins est dans `features/carte/lib/mesPins.ts` et
`features/carte/hooks/useMesPinsSurLaCarte.ts`, branché par `app/shell/Shell.tsx`.
