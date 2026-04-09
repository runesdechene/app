import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'

interface Slide {
  id: number | null
  phase: 'before' | 'after'
  position: number
  title: string
  body: string
  image_url: string | null
  active: boolean
}

const emptySlide = (phase: 'before' | 'after', position: number): Slide => ({
  id: null,
  phase,
  position,
  title: '',
  body: '',
  image_url: null,
  active: true,
})

export function TutorialManager() {
  const [slides, setSlides] = useState<Slide[]>([])
  const [savedSlides, setSavedSlides] = useState<Slide[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  const hasChanges = JSON.stringify(slides) !== JSON.stringify(savedSlides)

  useEffect(() => { fetchSlides() }, [])

  async function fetchSlides() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('tutorial_slides')
      .select('*')
      .order('phase')
      .order('position')
    if (err) { setError(err.message); setLoading(false); return }
    const list = (data ?? []) as Slide[]
    setSlides(JSON.parse(JSON.stringify(list)))
    setSavedSlides(JSON.parse(JSON.stringify(list)))
    setLoading(false)
  }

  function addSlide(phase: 'before' | 'after') {
    const phaseSlides = slides.filter(s => s.phase === phase)
    const maxPos = phaseSlides.length > 0 ? Math.max(...phaseSlides.map(s => s.position)) : 0
    setSlides([...slides, emptySlide(phase, maxPos + 1)])
  }

  function updateSlide(index: number, field: keyof Slide, value: string | boolean | number) {
    const updated = [...slides]
    ;(updated[index] as unknown as Record<string, unknown>)[field] = value
    setSlides(updated)
  }

  function removeSlide(index: number) {
    setSlides(slides.filter((_, i) => i !== index))
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const slide = slides[index]
    const samePhase = slides.filter(s => s.phase === slide.phase)
    const otherPhase = slides.filter(s => s.phase !== slide.phase)
    const phaseIndex = samePhase.findIndex(s => s === slide)
    const swapIndex = phaseIndex + direction
    if (swapIndex < 0 || swapIndex >= samePhase.length) return
    const temp = samePhase[phaseIndex]
    samePhase[phaseIndex] = samePhase[swapIndex]
    samePhase[swapIndex] = temp
    samePhase.forEach((s, i) => { s.position = i + 1 })
    setSlides([
      ...otherPhase,
      ...samePhase,
    ].sort((a, b) => a.phase.localeCompare(b.phase) || a.position - b.position))
  }

  async function handleImageUpload(index: number, file: File) {
    const ext = file.name.split('.').pop() || 'webp'
    const path = `tutorial/${Date.now()}_${index}.${ext}`
    const { error: upErr } = await supabase.storage.from('place-images').upload(path, file, { upsert: true })
    if (upErr) { setError(upErr.message); return }
    const { data: urlData } = supabase.storage.from('place-images').getPublicUrl(path)
    updateSlide(index, 'image_url', urlData.publicUrl)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const savedIds = savedSlides.map(s => s.id).filter(Boolean) as number[]
    const currentIds = slides.map(s => s.id).filter(Boolean) as number[]
    const toDelete = savedIds.filter(id => !currentIds.includes(id))
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from('tutorial_slides').delete().in('id', toDelete)
      if (delErr) { setError(delErr.message); setSaving(false); return }
    }

    for (const slide of slides) {
      const row = {
        phase: slide.phase,
        position: slide.position,
        title: slide.title,
        body: slide.body,
        image_url: slide.image_url,
        active: slide.active,
        updated_at: new Date().toISOString(),
      }
      if (slide.id) {
        const { error: upErr } = await supabase.from('tutorial_slides').update(row).eq('id', slide.id)
        if (upErr) { setError(upErr.message); setSaving(false); return }
      } else {
        const { error: insErr } = await supabase.from('tutorial_slides').insert(row)
        if (insErr) { setError(insErr.message); setSaving(false); return }
      }
    }

    await fetchSlides()
    setSaving(false)
  }

  function handleCancel() {
    setSlides(JSON.parse(JSON.stringify(savedSlides)))
    setError(null)
  }

  async function handleForceReset() {
    const { error: err } = await supabase
      .from('users')
      .update({ tutorial_completed_at: null })
      .not('tutorial_completed_at', 'is', null)
    if (err) { setError(err.message) } else { setConfirmReset(false) }
  }

  function renderPhase(phase: 'before' | 'after', label: string) {
    const phaseSlides = slides
      .map((s, originalIndex) => ({ ...s, originalIndex }))
      .filter(s => s.phase === phase)
      .sort((a, b) => a.position - b.position)

    return (
      <div className="tutorial-phase-section">
        <h3>{label}</h3>
        {phaseSlides.length === 0 && <p style={{ opacity: 0.5 }}>Aucun slide</p>}
        {phaseSlides.map((slide) => (
          <div key={slide.originalIndex} className="tutorial-slide-card">
            <div className="tutorial-slide-header">
              <span className="tutorial-slide-pos">#{slide.position}</span>
              <button onClick={() => moveSlide(slide.originalIndex, -1)} title="Monter">&#9650;</button>
              <button onClick={() => moveSlide(slide.originalIndex, 1)} title="Descendre">&#9660;</button>
              <label className="tutorial-slide-toggle">
                <input
                  type="checkbox"
                  checked={slide.active}
                  onChange={e => updateSlide(slide.originalIndex, 'active', e.target.checked)}
                />
                Actif
              </label>
              <button className="tutorial-slide-delete" onClick={() => removeSlide(slide.originalIndex)}>
                Supprimer
              </button>
            </div>
            <input
              type="text"
              placeholder="Titre"
              value={slide.title}
              onChange={e => updateSlide(slide.originalIndex, 'title', e.target.value)}
              className="tutorial-slide-input"
            />
            <textarea
              placeholder="Corps du texte"
              value={slide.body}
              onChange={e => updateSlide(slide.originalIndex, 'body', e.target.value)}
              className="tutorial-slide-textarea"
              rows={4}
            />
            <div className="tutorial-slide-image-row">
              {slide.image_url && (
                <img src={slide.image_url} alt="" className="tutorial-slide-preview" />
              )}
              <input
                type="file"
                accept="image/*"
                ref={el => { if (el) fileRefs.current.set(slide.originalIndex, el) }}
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleImageUpload(slide.originalIndex, f)
                }}
                style={{ display: 'none' }}
              />
              <button onClick={() => fileRefs.current.get(slide.originalIndex)?.click()}>
                {slide.image_url ? 'Changer image' : 'Ajouter image'}
              </button>
              {slide.image_url && (
                <button onClick={() => updateSlide(slide.originalIndex, 'image_url', '')}>
                  Retirer image
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="tutorial-add-btn" onClick={() => addSlide(phase)}>
          + Ajouter un slide
        </button>
      </div>
    )
  }

  if (loading) return <div className="page"><p>Chargement...</p></div>

  return (
    <div className="page">
      <h1>Tutoriel</h1>

      {renderPhase('before', 'Avant onboarding — Philosophie')}
      {renderPhase('after', 'Après onboarding — Mécaniques')}

      <div style={{ marginTop: 32, borderTop: '1px solid #ddd', paddingTop: 16 }}>
        {!confirmReset ? (
          <button
            className="tutorial-reset-btn"
            onClick={() => setConfirmReset(true)}
          >
            Forcer le ré-affichage pour tous les joueurs
          </button>
        ) : (
          <div>
            <p style={{ color: '#c00' }}>
              Tous les joueurs reverront le tutoriel à leur prochaine connexion. Confirmer ?
            </p>
            <button onClick={handleForceReset} style={{ marginRight: 8 }}>Oui, forcer</button>
            <button onClick={() => setConfirmReset(false)}>Annuler</button>
          </div>
        )}
      </div>

      <SaveBar
        hasChanges={hasChanges}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  )
}
