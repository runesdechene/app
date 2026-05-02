import { EMOJI_BANK } from '../../lib/emojiBank'
import './EmojiPicker.css'

interface EmojiPickerProps {
  onPick: (emoji: string) => void
}

/**
 * V0.7+ Grille 5×7 (33 emojis curés RdC). Tap = envoi immédiat.
 * Picker reste ouvert tant qu'on tape dedans (surclick rafale autorisé).
 */
export function EmojiPicker({ onPick }: EmojiPickerProps) {
  return (
    <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
      {EMOJI_BANK.map(({ emoji }) => (
        <button
          key={emoji}
          type="button"
          className="emoji-picker__pick"
          onClick={(e) => {
            e.stopPropagation()
            onPick(emoji)
          }}
          aria-label={`Envoyer ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
