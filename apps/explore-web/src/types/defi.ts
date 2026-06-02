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
