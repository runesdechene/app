import './EnigmaResult.css'

interface EnigmaResultProps {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  onClose: () => void
  closeLabel?: string
}

export function EnigmaResult({ correct, answer, explanation, influenceGain, eruditionGain, onClose, closeLabel }: EnigmaResultProps) {
  return (
    <div className="enigma-result">
      <div className="enigma-result-icon">
        {correct
          ? <img src="/res/coffre_ouvert.webp" alt="" className="enigma-result-chest" />
          : <span className="enigma-result-wrong-icon">{'\u274C'}</span>
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

      <div className="enigma-result-gains">
        {influenceGain > 0 && (
          <div className="enigma-result-gain influence">
            +{influenceGain} point influence
          </div>
        )}
        {eruditionGain > 0 && (
          <div className="enigma-result-gain erudition">
            +{eruditionGain} point d'érudition
          </div>
        )}
      </div>

      <button className="enigma-result-next" onClick={onClose}>
        {closeLabel ?? 'Fermer'}
      </button>
    </div>
  )
}
