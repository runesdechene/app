// V0.7+ Banque emoji curée RdC — miroir frontend de la table allowed_emojis (mig 055).
// Utilisée pour le rendu du picker. La validation finale est côté serveur (validate_emoji_throw / react_to_note).

export type EmojiCategory =
  | 'salutation'
  | 'nature'
  | 'aventure'
  | 'patrimoine'
  | 'convivial'
  | 'esprit'
  | 'recompense'

export interface EmojiEntry {
  emoji: string
  category: EmojiCategory
}

export const EMOJI_BANK: EmojiEntry[] = [
  { emoji: '👋', category: 'salutation' },
  { emoji: '❤️', category: 'salutation' },
  { emoji: '🤝', category: 'salutation' },
  { emoji: '😊', category: 'salutation' },
  { emoji: '👏', category: 'salutation' },
  { emoji: '🥰', category: 'salutation' },
  { emoji: '🙏', category: 'salutation' },
  { emoji: '🌳', category: 'nature' },
  { emoji: '🌿', category: 'nature' },
  { emoji: '🍃', category: 'nature' },
  { emoji: '🍂', category: 'nature' },
  { emoji: '🌧️', category: 'nature' },
  { emoji: '☀️', category: 'nature' },
  { emoji: '🌙', category: 'nature' },
  { emoji: '🔥', category: 'nature' },
  { emoji: '🥾', category: 'aventure' },
  { emoji: '🪨', category: 'aventure' },
  { emoji: '🗝️', category: 'aventure' },
  { emoji: '🪶', category: 'aventure' },
  { emoji: '🦅', category: 'aventure' },
  { emoji: '⛪', category: 'patrimoine' },
  { emoji: '🏛️', category: 'patrimoine' },
  { emoji: '🛖', category: 'patrimoine' },
  { emoji: '🪦', category: 'patrimoine' },
  { emoji: '🪵', category: 'patrimoine' },
  { emoji: '☕', category: 'convivial' },
  { emoji: '🍞', category: 'convivial' },
  { emoji: '🍷', category: 'convivial' },
  { emoji: '⚔️', category: 'esprit' },
  { emoji: '🛡️', category: 'esprit' },
  { emoji: '🌫️', category: 'esprit' },
  { emoji: '🐺', category: 'esprit' },
  { emoji: '🪙', category: 'recompense' },
]

const ALLOWED = new Set(EMOJI_BANK.map(e => e.emoji))

export function isAllowedEmoji(emoji: string): boolean {
  return ALLOWED.has(emoji)
}
