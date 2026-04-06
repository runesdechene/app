import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

type EnigmaType = 'daily' | 'place'
type Difficulty = 'easy' | 'medium' | 'hard'
type AnswerFormat = 'qcm' | 'free'

interface Enigma {
  id: number
  type: EnigmaType
  difficulty: Difficulty
  heritage_id: string | null
  place_tag: string | null
  lore_text: string
  question: string
  answer_format: AnswerFormat
  choices: string[] | null
  answer: string
  explanation: string
  is_active: boolean
  created_at: string
  total_answers: number
  correct_pct: number
}

interface Faction {
  id: string
  title: string
}

interface Tag {
  id: string
  title: string
}

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
}

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
}

const TYPE_LABELS: Record<EnigmaType, string> = {
  daily: 'Quotidienne',
  place: 'De lieu',
}

const PER_PAGE = 20

const EMPTY_ENIGMA: Omit<Enigma, 'id' | 'created_at' | 'total_answers' | 'correct_pct'> = {
  type: 'daily',
  difficulty: 'easy',
  heritage_id: null,
  place_tag: null,
  lore_text: '',
  question: '',
  answer_format: 'qcm',
  choices: ['', '', '', ''],
  answer: '',
  explanation: '',
  is_active: true,
}

export function Enigmas() {
  const [enigmas, setEnigmas] = useState<Enigma[]>([])
  const [savedEnigmas, setSavedEnigmas] = useState<Enigma[]>([])
  const [factions, setFactions] = useState<Faction[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Filters
  const [filterType, setFilterType] = useState<EnigmaType | 'all'>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | 'all'>('all')
  const [filterHeritage, setFilterHeritage] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)

  // Editing
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [editForm, setEditForm] = useState(EMPTY_ENIGMA)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [enigmasRes, factionsRes, tagsRes] = await Promise.all([
        supabase.from('enigmas').select('*').order('created_at', { ascending: false }),
        supabase.from('factions').select('id, title').order('title'),
        supabase.from('tags').select('id, title').order('order'),
      ])

      if (enigmasRes.data) {
        const mapped = (enigmasRes.data as Record<string, unknown>[]).map(e => ({
          id: Number(e.id),
          type: (e.type as EnigmaType) || 'daily',
          difficulty: (e.difficulty as Difficulty) || 'easy',
          heritage_id: (e.heritage_id as string | null) ?? null,
          place_tag: (e.place_tag as string | null) ?? null,
          lore_text: String(e.lore_text ?? ''),
          question: String(e.question ?? ''),
          answer_format: (e.answer_format as AnswerFormat) || 'qcm',
          choices: (e.choices as string[] | null) ?? null,
          answer: String(e.answer ?? ''),
          explanation: String(e.explanation ?? ''),
          is_active: Boolean(e.is_active),
          created_at: String(e.created_at ?? ''),
          total_answers: Number(e.total_answers ?? 0),
          correct_pct: Number(e.correct_pct ?? 0),
        }))
        setEnigmas(mapped)
        setSavedEnigmas(JSON.parse(JSON.stringify(mapped)))
      }
      if (factionsRes.data) setFactions(factionsRes.data as Faction[])
      if (tagsRes.data) setTags(tagsRes.data as Tag[])
    } finally {
      setLoading(false)
    }
  }

  // Filtered & paginated list
  const filtered = useMemo(() => {
    return enigmas.filter(e => {
      if (filterType !== 'all' && e.type !== filterType) return false
      if (filterDifficulty !== 'all' && e.difficulty !== filterDifficulty) return false
      if (filterHeritage !== 'all' && e.heritage_id !== filterHeritage) return false
      if (filterActive === 'active' && !e.is_active) return false
      if (filterActive === 'inactive' && e.is_active) return false
      return true
    })
  }, [enigmas, filterType, filterDifficulty, filterHeritage, filterActive])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = useMemo(() => {
    const start = (page - 1) * PER_PAGE
    return filtered.slice(start, start + PER_PAGE)
  }, [filtered, page])

  // Stats
  const stats = useMemo(() => ({
    total: enigmas.length,
    active: enigmas.filter(e => e.is_active).length,
    daily: enigmas.filter(e => e.type === 'daily').length,
    place: enigmas.filter(e => e.type === 'place').length,
  }), [enigmas])

  // Toggle active
  async function toggleActive(id: number) {
    const enigma = enigmas.find(e => e.id === id)
    if (!enigma) return
    const newActive = !enigma.is_active
    const { error } = await supabase
      .from('enigmas')
      .update({ is_active: newActive })
      .eq('id', id)
    if (!error) {
      setEnigmas(prev => prev.map(e => e.id === id ? { ...e, is_active: newActive } : e))
      setSavedEnigmas(prev => prev.map(e => e.id === id ? { ...e, is_active: newActive } : e))
    }
  }

  // Edit form
  function startEdit(enigma: Enigma) {
    setEditingId(enigma.id)
    setEditForm({
      type: enigma.type,
      difficulty: enigma.difficulty,
      heritage_id: enigma.heritage_id,
      place_tag: enigma.place_tag,
      lore_text: enigma.lore_text,
      question: enigma.question,
      answer_format: enigma.answer_format,
      choices: enigma.choices ? [...enigma.choices] : ['', '', '', ''],
      answer: enigma.answer,
      explanation: enigma.explanation,
      is_active: enigma.is_active,
    })
  }

  function startCreate() {
    setEditingId('new')
    setEditForm({ ...EMPTY_ENIGMA, choices: ['', '', '', ''] })
  }

  function cancelEdit() {
    setEditingId(null)
    setSaveError(null)
  }

  function updateChoice(idx: number, value: string) {
    setEditForm(prev => {
      const choices = [...(prev.choices || ['', '', '', ''])]
      choices[idx] = value
      return { ...prev, choices }
    })
  }

  function addChoice() {
    setEditForm(prev => ({
      ...prev,
      choices: [...(prev.choices || []), ''],
    }))
  }

  function removeChoice(idx: number) {
    setEditForm(prev => ({
      ...prev,
      choices: (prev.choices || []).filter((_, i) => i !== idx),
    }))
  }

  async function handleSaveForm() {
    setSaving(true)
    setSaveError(null)

    const payload = {
      type: editForm.type,
      difficulty: editForm.difficulty,
      heritage_id: editForm.heritage_id || null,
      place_tag: editForm.place_tag || null,
      lore_text: editForm.lore_text,
      question: editForm.question,
      answer_format: editForm.answer_format,
      choices: editForm.answer_format === 'qcm'
        ? (editForm.choices || []).filter(c => c.trim())
        : null,
      answer: editForm.answer,
      explanation: editForm.explanation,
      is_active: editForm.is_active,
    }

    if (editingId === 'new') {
      const { error } = await supabase.from('enigmas').insert(payload)
      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('enigmas')
        .update(payload)
        .eq('id', editingId!)
      if (error) {
        setSaveError(error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setEditingId(null)
    await fetchData()
  }

  // Delete
  async function handleDelete(id: number) {
    if (!window.confirm('Supprimer cette enigme ?')) return
    const { error } = await supabase.from('enigmas').delete().eq('id', id)
    if (!error) {
      setEnigmas(prev => prev.filter(e => e.id !== id))
      setSavedEnigmas(prev => prev.filter(e => e.id !== id))
    }
  }

  // SaveBar: detect local changes (for inline edits that don't use the form)
  const hasChanges = JSON.stringify(enigmas) !== JSON.stringify(savedEnigmas)

  async function handleBulkSave() {
    setSaving(true)
    setSaveError(null)
    try {
      for (const e of enigmas) {
        const saved = savedEnigmas.find(s => s.id === e.id)
        if (JSON.stringify(e) !== JSON.stringify(saved)) {
          const { error } = await supabase
            .from('enigmas')
            .update({
              type: e.type,
              difficulty: e.difficulty,
              heritage_id: e.heritage_id,
              place_tag: e.place_tag,
              lore_text: e.lore_text,
              question: e.question,
              answer_format: e.answer_format,
              choices: e.choices,
              answer: e.answer,
              explanation: e.explanation,
              is_active: e.is_active,
            })
            .eq('id', e.id)
          if (error) {
            setSaveError(error.message)
            break
          }
        }
      }
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  function handleBulkCancel() {
    setEnigmas(JSON.parse(JSON.stringify(savedEnigmas)))
    setSaveError(null)
  }

  if (loading) return <div className="loading">Chargement...</div>

  // Edit/Create form view
  if (editingId !== null) {
    return (
      <div className="section">
        <button className="ud-back" onClick={cancelEdit}>
          &larr; Retour a la liste
        </button>
        <h1 style={{ marginTop: 12 }}>
          {editingId === 'new' ? 'Nouvelle enigme' : `Modifier enigme #${editingId}`}
        </h1>

        {saveError && (
          <div style={{ color: '#ef4444', marginBottom: 12 }}>{saveError}</div>
        )}

        <div className="divers-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label className="settings-global-field">
              <span>Type</span>
              <select
                value={editForm.type}
                onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value as EnigmaType }))}
                className="settings-input"
              >
                <option value="daily">Quotidienne</option>
                <option value="place">De lieu</option>
              </select>
            </label>
            <label className="settings-global-field">
              <span>Difficulte</span>
              <select
                value={editForm.difficulty}
                onChange={e => setEditForm(prev => ({ ...prev, difficulty: e.target.value as Difficulty }))}
                className="settings-input"
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyen</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
            <label className="settings-global-field">
              <span>Heritage</span>
              <select
                value={editForm.heritage_id || ''}
                onChange={e => setEditForm(prev => ({ ...prev, heritage_id: e.target.value || null }))}
                className="settings-input"
              >
                <option value="">Aucun (universel)</option>
                {factions.map(f => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
            </label>
            <label className="settings-global-field">
              <span>Tag de lieu</span>
              <select
                value={editForm.place_tag || ''}
                onChange={e => setEditForm(prev => ({ ...prev, place_tag: e.target.value || null }))}
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
              value={editForm.lore_text}
              onChange={e => setEditForm(prev => ({ ...prev, lore_text: e.target.value }))}
              className="faction-description-input"
              rows={3}
              placeholder="Un peu de contexte historique ou narratif..."
            />
          </div>

          <div className="faction-field" style={{ marginBottom: 12 }}>
            <label className="faction-field-label">Question</label>
            <textarea
              value={editForm.question}
              onChange={e => setEditForm(prev => ({ ...prev, question: e.target.value }))}
              className="faction-description-input"
              rows={2}
              placeholder="La question posee au joueur..."
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <label className="settings-global-field">
              <span>Format de reponse</span>
              <select
                value={editForm.answer_format}
                onChange={e => setEditForm(prev => ({ ...prev, answer_format: e.target.value as AnswerFormat }))}
                className="settings-input"
              >
                <option value="qcm">QCM</option>
                <option value="free">Libre</option>
              </select>
            </label>
          </div>

          {editForm.answer_format === 'qcm' && (
            <div className="faction-field" style={{ marginBottom: 12 }}>
              <label className="faction-field-label">Choix</label>
              {(editForm.choices || []).map((choice, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <input
                    type="text"
                    value={choice}
                    onChange={e => updateChoice(idx, e.target.value)}
                    className="faction-title-input"
                    placeholder={`Choix ${idx + 1}`}
                  />
                  {(editForm.choices || []).length > 2 && (
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
              value={editForm.answer}
              onChange={e => setEditForm(prev => ({ ...prev, answer: e.target.value }))}
              className="faction-title-input"
              placeholder="La bonne reponse..."
            />
          </div>

          <div className="faction-field" style={{ marginBottom: 12 }}>
            <label className="faction-field-label">Explication</label>
            <textarea
              value={editForm.explanation}
              onChange={e => setEditForm(prev => ({ ...prev, explanation: e.target.value }))}
              className="faction-description-input"
              rows={2}
              placeholder="Pourquoi cette reponse est correcte..."
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={editForm.is_active}
              onChange={e => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
            />
            <span>Active</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={handleSaveForm} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
          <button className="btn-secondary" onClick={cancelEdit}>
            Annuler
          </button>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <div className="page-header">
        <h1>Enigmes</h1>
        <div className="page-header-actions">
          <button className="btn-primary" onClick={startCreate}>
            + Nouvelle enigme
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'rgba(193,154,107,0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: '#6b5a47' }}>Total</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'rgba(42,122,48,0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2a7a30' }}>{stats.active}</div>
          <div style={{ fontSize: 11, color: '#6b5a47' }}>Actives</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#3b82f6' }}>{stats.daily}</div>
          <div style={{ fontSize: 11, color: '#6b5a47' }}>Quotidiennes</div>
        </div>
        <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{stats.place}</div>
          <div style={{ fontSize: 11, color: '#6b5a47' }}>De lieu</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value as EnigmaType | 'all'); setPage(1) }}
          className="settings-input"
        >
          <option value="all">Tous types</option>
          <option value="daily">Quotidienne</option>
          <option value="place">De lieu</option>
        </select>
        <select
          value={filterDifficulty}
          onChange={e => { setFilterDifficulty(e.target.value as Difficulty | 'all'); setPage(1) }}
          className="settings-input"
        >
          <option value="all">Toutes difficultes</option>
          <option value="easy">Facile</option>
          <option value="medium">Moyen</option>
          <option value="hard">Difficile</option>
        </select>
        <select
          value={filterHeritage}
          onChange={e => { setFilterHeritage(e.target.value); setPage(1) }}
          className="settings-input"
        >
          <option value="all">Tous heritages</option>
          {factions.map(f => (
            <option key={f.id} value={f.id}>{f.title}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={e => { setFilterActive(e.target.value as 'all' | 'active' | 'inactive'); setPage(1) }}
          className="settings-input"
        >
          <option value="all">Actives + Inactives</option>
          <option value="active">Actives seulement</option>
          <option value="inactive">Inactives seulement</option>
        </select>
      </div>

      {/* Enigma list */}
      {filtered.length === 0 ? (
        <div className="empty">Aucune enigme trouvee</div>
      ) : (
        <>
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Difficulte</th>
                <th>Question</th>
                <th>Heritage</th>
                <th>Reponses</th>
                <th>% Correct</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(e => {
                const factionName = e.heritage_id
                  ? factions.find(f => f.id === e.heritage_id)?.title ?? '-'
                  : 'Universel'
                return (
                  <tr key={e.id}>
                    <td style={{ fontSize: 11 }}>#{e.id}</td>
                    <td>
                      <span style={{ fontSize: 11 }}>{TYPE_LABELS[e.type]}</span>
                    </td>
                    <td>
                      <span style={{ color: DIFFICULTY_COLORS[e.difficulty], fontWeight: 600, fontSize: 12 }}>
                        {DIFFICULTY_LABELS[e.difficulty]}
                      </span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.question || <span style={{ opacity: 0.4 }}>Pas de question</span>}
                    </td>
                    <td style={{ fontSize: 11 }}>{factionName}</td>
                    <td style={{ textAlign: 'center' }}>{e.total_answers}</td>
                    <td style={{ textAlign: 'center' }}>
                      {e.total_answers > 0 ? `${e.correct_pct}%` : '-'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => toggleActive(e.id)}
                        className={e.is_active ? 'btn-primary' : 'btn-secondary'}
                        style={{ fontSize: 11, padding: '2px 8px', minWidth: 50 }}
                      >
                        {e.is_active ? 'Oui' : 'Non'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn-secondary"
                          onClick={() => startEdit(e)}
                          style={{ fontSize: 11, padding: '2px 8px' }}
                        >
                          Modifier
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleDelete(e.id)}
                          style={{ fontSize: 11, padding: '2px 8px' }}
                        >
                          &times;
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="users-pagination">
              <button
                className="users-page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Precedent
              </button>
              <span className="users-page-info">
                Page {page} / {totalPages}
              </span>
              <button
                className="users-page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        error={saveError}
        onSave={handleBulkSave}
        onCancel={handleBulkCancel}
      />
    </div>
  )
}
