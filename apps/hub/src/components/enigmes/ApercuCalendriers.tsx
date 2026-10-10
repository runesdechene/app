import { balisesIncomprises, CALENDRIERS, texteEnClair } from '@runes/calendrier'
import type { EnigmaForm } from './types'

// L'énigme telle que la liront les joueurs dans chaque calendrier (spec 2026-10-09-choix-du-calendrier).
// Une date s'écrit entre accolades, en chrétien : {52 av. J.-C.}, {IIIe siècle av. J.-C.}. Une balise
// incomprise s'afficherait telle quelle chez le joueur : on la signale.
export function ApercuCalendriers({ form }: { form: EnigmaForm }) {
  const choix = form.format === 'qcm' ? form.choices ?? [] : []
  const textes = [form.lore_text, form.question, ...choix, form.answer, form.explanation]
  if (!textes.some(t => /[{}]/.test(t))) return null
  const incomprises = textes.flatMap(balisesIncomprises)

  return (
    <div className="faction-field" style={{ marginBottom: 12 }}>
      <label className="faction-field-label">Aperçu des dates</label>
      {incomprises.length > 0 && (
        <div style={{ color: '#ef4444', marginBottom: 8 }}>
          Balises incomprises : {incomprises.join(' · ')}
        </div>
      )}
      {CALENDRIERS.map(c => (
        <details key={c.id}>
          <summary>{c.libelle}</summary>
          <p>{texteEnClair(form.lore_text, c.id)}</p>
          <p><strong>{texteEnClair(form.question, c.id)}</strong></p>
          {choix.length > 0 && (
            <ul>
              {choix.map((ch, i) => <li key={i}>{texteEnClair(ch, c.id)}</li>)}
            </ul>
          )}
          <p>Réponse : {texteEnClair(form.answer, c.id)}</p>
          <p>{texteEnClair(form.explanation, c.id)}</p>
        </details>
      ))}
    </div>
  )
}
