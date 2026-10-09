// Les énigmes telles que le Hub les lit et les écrit (table enigmas).
export type EnigmaType = 'daily' | 'place'
export type Difficulty = 'very_easy' | 'easy' | 'medium' | 'hard'
export type AnswerFormat = 'qcm' | 'free'

export interface Enigma {
  id: number
  type: EnigmaType
  difficulty: Difficulty
  theme: string | null
  place_tag: string | null
  lore_text: string
  question: string
  format: AnswerFormat
  choices: string[] | null
  answer: string
  accepted_answers: string[]
  explanation: string
  active: boolean
  created_at: string
}

export interface Theme {
  id: string
  label: string
}

export interface Tag {
  id: string
  title: string
}

export type EnigmaForm = Omit<Enigma, 'id' | 'created_at'>
