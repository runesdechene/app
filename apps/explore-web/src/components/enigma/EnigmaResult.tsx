import './EnigmaResult.css'

interface EnigmaResultProps {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  onClose: () => void
}

export function EnigmaResult({ correct, answer, explanation, influenceGain, eruditionGain, onClose }: EnigmaResultProps) {
  return (
    <div className="enigma-result">
      <span className="enigma-result-icon">
        {correct ? '\u2705' : '\u274C'}
      </span>

      <div className={`enigma-result-label ${correct ? 'correct' : 'wrong'}`}>
        {correct ? 'Bonne r\u00e9ponse !' : 'Mauvaise r\u00e9ponse'}
      </div>

      {!correct && (
        <div className="enigma-result-answer">
          R\u00e9ponse : {answer}
        </div>
      )}

      <div className="enigma-result-explanation">
        {explanation}
      </div>

      <div className="enigma-result-gains">
        {influenceGain > 0 && (
          <div className="enigma-result-gain influence">
            +{influenceGain} influence
          </div>
        )}
        {eruditionGain > 0 && (
          <div className="enigma-result-gain erudition">
            +{eruditionGain} \u00e9rudition
          </div>
        )}
      </div>

      <button className="enigma-result-close" onClick={onClose}>
        Fermer
      </button>
    </div>
  )
}
