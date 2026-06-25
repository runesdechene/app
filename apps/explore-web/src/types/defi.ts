export interface Defi {
  id: string
  action: 'reveal' | 'visit' | 'add' | 'veilleur' | 'enigma'
  scope: 'individual' | 'collective'
  cadence: 'daily' | 'weekly'
  title: string
  icon: string
  tagId: string | null
  target: number
  reward: number
  progress: number
  myContribution: number
  claimed: boolean
  /** Fin de la fenêtre du défi (ISO). Sert au compte à rebours sur les défis hebdo. */
  endsAt: string | null
  /** Collectif uniquement : instant où l'objectif a été atteint (ISO), sinon null.
   *  Une fois atteint, le défi est fermé : seuls les contributeurs d'avant sont récompensés. */
  completedAt?: string | null
  /** Collectif uniquement : 1re contribution du joueur sur la fenêtre (ISO), sinon null.
   *  À temps si ≤ completedAt. */
  myFirstContribAt?: string | null
  /** Visuels du tag de lieu ciblé (null si pas de tag, ex. énigme). */
  tag: { icon: string | null; color: string; background: string; title: string } | null
}

export interface DefisBoard {
  daily: Defi | null
  weeklyIndividual: Defi | null
  weeklyCollective: Defi | null
}

export interface DefiRewardPopup {
  icon: string
  title: string
  crowns: number
}
