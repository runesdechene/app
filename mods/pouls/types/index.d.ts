// Le contrat du mod : l'état que le panneau lit et que les gestes écrivent.
// Periode, Pouls et Avant redisent ceux de supabase/functions/pouls/reponse.ts, qui ne se partage pas.

export type Periode = 'jour' | 'semaine' | 'mois' | 'toujours'
export type Pouls = { nouveaux: number; reactives: number; actifs: number; lieux: number; visites: number; enigmes: number }
export type Avant = Omit<Pouls, 'actifs'>

export type Options = { url: string; secret: string }

// lu_a est en millisecondes : le fil porte une date ISO, la lecture la convertit à la frontière.
export type Lecture =
  | { ok: true; periode: Periode; pouls: Pouls; avant: Avant | null; lu_a: number }
  | { ok: false; raison: 'secret_absent' | 'refus' | 'reseau' }

declare module 'claude-code' {
  interface PluginState {
    pouls: { derniere: Lecture | null; periode: Periode; replie: boolean }
  }
}
