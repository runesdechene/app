import './EnigmaResult.css'

// V0.6 — Refonte Gloire/Coupe : on n'affiche plus "+X point d'érudition"
// ni "+X point influence" (V0.5 figé). À la place, on dit simplement le
// gain commun à la Coupe et à la Gloire (+1 par énigme correcte, formule
// unifiée mig 023+024).
//
// Les props influenceGain/eruditionGain sont conservés dans la signature
// pour rétrocompat avec les RPCs serveur (DailyEnigma, PlaceEnigma,
// FragmentEnigma), mais ne sont plus utilisés à l'affichage.

interface EnigmaResultProps {
  correct: boolean
  answer: string
  explanation: string
  /** @deprecated V0.5 — gardé pour compat appelants */
  influenceGain: number
  /** @deprecated V0.5 — gardé pour compat appelants */
  eruditionGain: number
  /** V0.6 — difficulté de l'énigme pour calculer le gain pondéré 1/1/2/3 */
  difficulty?: 'very_easy' | 'easy' | 'medium' | 'hard'
  onClose: () => void
  closeLabel?: string
}

const DIFFICULTY_GAIN: Record<string, number> = {
  very_easy: 1,
  easy:      1,
  medium:    2,
  hard:      3,
}

export function EnigmaResult({ correct, answer, explanation, difficulty, onClose, closeLabel }: EnigmaResultProps) {
  const gain = difficulty ? (DIFFICULTY_GAIN[difficulty] ?? 1) : 1
  return (
    <div className="enigma-result">
      <div className="enigma-result-icon">
        {correct
          ? <img src="/res/coffre_ouvert.webp" alt="" className="enigma-result-chest" />
          : <span className="enigma-result-wrong-icon">{'❌'}</span>
        }
      </div>

      <div className={`enigma-result-label ${correct ? 'correct' : 'wrong'}`}>
        {correct ? 'Bonne réponse !' : 'Mauvaise réponse'}
      </div>

      {!correct && (
        <div className="enigma-result-answer">
          Réponse : {answer}
        </div>
      )}

      <div className="enigma-result-explanation">
        {explanation}
      </div>

      {correct && (
        <div className="enigma-result-gains">
          <div className="enigma-result-gain glory">
            {'🎖️'} +{gain} Gloire
          </div>
          <div className="enigma-result-gain coupe">
            {'🏆'} +{gain} Coupe
          </div>
          <div className="enigma-result-gain enigma">
            {'📖'} +1 énigme validée
          </div>
        </div>
      )}

      <button className="enigma-result-next" onClick={onClose}>
        {closeLabel ?? 'Fermer'}
      </button>
    </div>
  )
}
