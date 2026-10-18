// Le contrat du mod : l'état que le panneau lit et que les gestes écrivent.
// Periode, Pouls et Avant redisent ceux de supabase/functions/pouls/reponse.ts, qui ne se partage pas.

export type Periode = 'jour' | 'semaine' | 'mois' | 'toujours'
export type Pouls = { nouveaux: number; reactives: number; actifs: number; lieux: number; visites: number; enigmes: number }
export type Avant = Omit<Pouls, 'actifs'>

export type Options = { url: string; secret: string }

// lu_a est en millisecondes : le fil porte une date ISO, la lecture la convertit à la frontière.
export type Reussie = { ok: true; periode: Periode; pouls: Pouls; avant: Avant | null; lu_a: number }
export type Raison = 'secret_absent' | 'refus' | 'reseau'
export type Lecture = Reussie | { ok: false; raison: Raison }

declare module 'claude-code' {
  interface PluginState {
    // derniere : la dernière lecture réussie, jamais écrasée par un échec (echec dit pourquoi la suivante a raté).
    pouls: { derniere: Reussie | null; echec: Raison | null; periode: Periode; replie: boolean }
  }
}
