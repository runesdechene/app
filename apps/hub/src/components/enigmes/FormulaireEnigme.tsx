import type { Dispatch, SetStateAction } from 'react'
import type { AnswerFormat, Difficulty, EnigmaForm, EnigmaType, Tag, Theme } from './types'

// Le formulaire d'une énigme : sorti d'Enigmas.tsx quand il a dépassé 700 lignes (variantes, mig 464).
export function FormulaireEnigme({
  form,
  setForm,
  themes,
  tags,
}: {
  form: EnigmaForm
  setForm: Dispatch<SetStateAction<EnigmaForm>>
  themes: Theme[]
  tags: Tag[]
}) {
  function updateChoice(idx: number, value: string) {
    setForm(prev => {
      const choices = [...(prev.choices || ['', '', '', ''])]
      choices[idx] = value
      return { ...prev, choices }
    })
  }

  function addChoice() {
    setForm(prev => ({
      ...prev,
      choices: [...(prev.choices || []), ''],
    }))
  }

  function removeChoice(idx: number) {
    setForm(prev => ({
      ...prev,
      choices: (prev.choices || []).filter((_, i) => i !== idx),
    }))
  }

  return (
    <div className="divers-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <label className="settings-global-field">
          <span>Type</span>
          <select
            value={form.type}
            onChange={e => setForm(prev => ({ ...prev, type: e.target.value as EnigmaType }))}
            className="settings-input"
          >
            <option value="daily">Quotidienne</option>
            <option value="place">De lieu</option>
          </select>
        </label>
        <label className="settings-global-field">
          <span>Difficulte</span>
          <select
            value={form.difficulty}
            onChange={e => setForm(prev => ({ ...prev, difficulty: e.target.value as Difficulty }))}
            className="settings-input"
          >
            <option value="very_easy">Très facile</option>
            <option value="easy">Facile</option>
            <option value="medium">Moyen</option>
            <option value="hard">Difficile</option>
          </select>
        </label>
        <label className="settings-global-field">
          <span>Thème</span>
          <select
            value={form.theme || ''}
            onChange={e => setForm(prev => ({ ...prev, theme: e.target.value || null }))}
            className="settings-input"
          >
            <option value="">Aucun (universel)</option>
            {themes.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="settings-global-field">
          <span>Tag de lieu</span>
          <select
            value={form.place_tag || ''}
            onChange={e => setForm(prev => ({ ...prev, place_tag: e.target.value || null }))}
            className="settings-input"
          >
            <option value="">Aucun</option>
            {tags.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="faction-field" style={{ marginBottom: 12 }}>
        <label className="faction-field-label">Texte narratif (lore)</label>
        <textarea
          value={form.lore_text}
          onChange={e => setForm(prev => ({ ...prev, lore_text: e.target.value }))}
          className="faction-description-input"
          rows={3}
          placeholder="Un peu de contexte historique ou narratif..."
        />
      </div>

      <div className="faction-field" style={{ marginBottom: 12 }}>
        <label className="faction-field-label">Question</label>
        <textarea
          value={form.question}
          onChange={e => setForm(prev => ({ ...prev, question: e.target.value }))}
          className="faction-description-input"
          rows={2}
          placeholder="La question posee au joueur..."
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <label className="settings-global-field">
          <span>Format de reponse</span>
          <select
            value={form.format}
            onChange={e => setForm(prev => ({ ...prev, format: e.target.value as AnswerFormat }))}
            className="settings-input"
          >
            <option value="qcm">QCM</option>
            <option value="free">Libre</option>
          </select>
        </label>
      </div>

      {form.format === 'qcm' && (
        <div className="faction-field" style={{ marginBottom: 12 }}>
          <label className="faction-field-label">Choix</label>
          {(form.choices || []).map((choice, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input
                type="text"
                value={choice}
                onChange={e => updateChoice(idx, e.target.value)}
                className="faction-title-input"
                placeholder={`Choix ${idx + 1}`}
              />
              {(form.choices || []).length > 2 && (
                <button className="btn-danger" onClick={() => removeChoice(idx)} title="Supprimer">
                  &times;
                </button>
              )}
            </div>
          ))}
          <button className="btn-secondary" onClick={addChoice} style={{ marginTop: 4 }}>
            + Ajouter un choix
          </button>
        </div>
      )}

      <div className="faction-field" style={{ marginBottom: 12 }}>
        <label className="faction-field-label">Reponse correcte</label>
        <input
          type="text"
          value={form.answer}
          onChange={e => setForm(prev => ({ ...prev, answer: e.target.value }))}
          className="faction-title-input"
          placeholder="La bonne reponse..."
        />
      </div>

      {form.format === 'free' && (
        <div className="faction-field" style={{ marginBottom: 12 }}>
          <label className="faction-field-label">Autres réponses acceptées (une par ligne)</label>
          <textarea
            value={form.accepted_answers.join('\n')}
            onChange={e => setForm(prev => ({ ...prev, accepted_answers: e.target.value.split('\n') }))}
            className="faction-description-input"
            rows={3}
            placeholder={'Eudes\nEudes Ier'}
          />
        </div>
      )}

      <div className="faction-field" style={{ marginBottom: 12 }}>
        <label className="faction-field-label">Explication</label>
        <textarea
          value={form.explanation}
          onChange={e => setForm(prev => ({ ...prev, explanation: e.target.value }))}
          className="faction-description-input"
          rows={2}
          placeholder="Pourquoi cette reponse est correcte..."
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
        />
        <span>Active</span>
      </label>
    </div>
  )
}
