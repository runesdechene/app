# shared — ce que plusieurs zones utilisent

- `supabase/` — le client unique et les types de la base. Seuls les dossiers `api/` des zones
  (et la garde d'accès) l'importent.
- `lib/` — le calcul pur partagé : les lecteurs du JSON de la base (`lire.ts`) ; le signal
  « un écran est derrière moi » que les zones posent sur un lien et que le cadre de détail lit
  (`retour.ts`).
- `ui/` — les briques d'interface génériques.
- `styles/` — les jetons de la DA et la remise à zéro CSS.

Règle d'entrée : un fichier monte ici quand **une deuxième zone** en a besoin, pas avant.
