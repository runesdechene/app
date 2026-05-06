import { useState } from 'react'
import { createExpedition } from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { listUpcomingExpeditions } from '../../lib/expeditionsApi'
import './ExpeditionCreator.css'

interface Props {
  onClose: () => void
  onCreated: (expeditionId: string) => void
  /** Coordonnées initiales (ex : centre de la carte au moment de l'ouverture). */
  initialLat?: number
  initialLng?: number
}

/**
 * Formulaire de création d'une expédition.
 * V1 : un seul écran scrollable (pas de stepper multi-page).
 * Le tap-on-map sera V1.5 — pour l'instant, lat/lng saisis manuellement
 * avec un bouton "ma position actuelle".
 */
export function ExpeditionCreator({ onClose, onCreated, initialLat, initialLng }: Props) {
  const setUpcoming = useExpeditionsStore((s) => s.setUpcoming)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rdvAt, setRdvAt] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16) // format datetime-local
  })
  const [rdvLat, setRdvLat] = useState<number | null>(initialLat ?? null)
  const [rdvLng, setRdvLng] = useState<number | null>(initialLng ?? null)
  const [rdvLabel, setRdvLabel] = useState('')
  const [slotsMode, setSlotsMode] = useState<'fixed' | 'open'>('fixed')
  const [slotsMax, setSlotsMax] = useState(5)
  const [validationMode, setValidationMode] = useState<'manual' | 'free'>('manual')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setError("Géolocalisation indisponible sur ce navigateur")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRdvLat(pos.coords.latitude)
        setRdvLng(pos.coords.longitude)
      },
      () => setError("Impossible d'obtenir ta position"),
    )
  }

  async function handleSubmit() {
    setError(null)
    if (name.trim().length < 3) { setError('Le nom doit faire au moins 3 caractères'); return }
    if (rdvLat == null || rdvLng == null) { setError('Choisis un point de RDV'); return }
    const rdvDate = new Date(rdvAt)
    if (Number.isNaN(rdvDate.getTime()) || rdvDate.getTime() <= Date.now()) {
      setError('La date du RDV doit être dans le futur'); return
    }

    setSubmitting(true)
    const result = await createExpedition({
      name: name.trim(),
      description: description.trim() || null,
      rdv_at: rdvDate.toISOString(),
      rdv_lat: rdvLat,
      rdv_lng: rdvLng,
      rdv_label: rdvLabel.trim() || null,
      slots_max: slotsMode === 'fixed' ? slotsMax : null,
      slots_open: slotsMode === 'open',
      validation_mode: validationMode,
    })
    setSubmitting(false)

    if (!result.success || !result.expedition_id) {
      setError(translateError(result.error))
      return
    }
    // Refresh la liste pour que la nouvelle expé apparaisse au prochain ouverture du panneau
    listUpcomingExpeditions().then(setUpcoming).catch(() => {})
    onCreated(result.expedition_id)
  }

  return (
    <div className="expedition-creator-overlay" onClick={onClose}>
      <div className="expedition-creator" onClick={(e) => e.stopPropagation()}>
        <header className="expedition-creator-header">
          <div>
            <div className="expedition-creator-eyebrow">Nouvelle expédition</div>
            <h2 className="expedition-creator-title">Convoque tes compagnons</h2>
          </div>
          <button className="expedition-creator-close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <div className="expedition-creator-body">
          {/* Nom */}
          <section className="ec-section">
            <label className="ec-label">Nom de l'expédition</label>
            <input
              type="text"
              className="ec-input"
              placeholder="Bivouac sur le Vercors"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="ec-counter">{name.length} / 80</div>
          </section>

          {/* Description */}
          <section className="ec-section">
            <label className="ec-label">Description (optionnelle)</label>
            <textarea
              className="ec-textarea"
              placeholder="Ce que tu prévois, ce qu'il faut prévoir, le ton qu'on veut donner…"
              value={description}
              maxLength={1000}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="ec-counter">{description.length} / 1000</div>
          </section>

          {/* Date+heure */}
          <section className="ec-section">
            <label className="ec-label">Date et heure du RDV</label>
            <input
              type="datetime-local"
              className="ec-input"
              value={rdvAt}
              onChange={(e) => setRdvAt(e.target.value)}
            />
          </section>

          {/* Lieu */}
          <section className="ec-section">
            <label className="ec-label">Point de ralliement</label>
            <div className="ec-coords-row">
              <input
                type="number"
                className="ec-input ec-input-coord"
                placeholder="Latitude"
                value={rdvLat ?? ''}
                step="0.0001"
                onChange={(e) => setRdvLat(e.target.value ? parseFloat(e.target.value) : null)}
              />
              <input
                type="number"
                className="ec-input ec-input-coord"
                placeholder="Longitude"
                value={rdvLng ?? ''}
                step="0.0001"
                onChange={(e) => setRdvLng(e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
            <button type="button" className="ec-secondary-btn" onClick={useCurrentPosition}>
              📍 Utiliser ma position actuelle
            </button>
            <input
              type="text"
              className="ec-input"
              placeholder="Libellé du lieu (« Parking du Mont Aiguille »)"
              value={rdvLabel}
              maxLength={120}
              onChange={(e) => setRdvLabel(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </section>

          {/* Slots */}
          <section className="ec-section">
            <label className="ec-label">Combien de compagnons ?</label>
            <div className="ec-slots-row">
              <button
                type="button"
                className={`ec-slot-card${slotsMode === 'fixed' ? ' is-selected' : ''}`}
                onClick={() => setSlotsMode('fixed')}
              >
                <span className="ec-slot-num">{slotsMax}</span>
                <span className="ec-slot-label">places fixes</span>
              </button>
              <button
                type="button"
                className={`ec-slot-card${slotsMode === 'open' ? ' is-selected' : ''}`}
                onClick={() => setSlotsMode('open')}
              >
                <span className="ec-slot-num">∞</span>
                <span className="ec-slot-label">ouvert</span>
              </button>
            </div>
            {slotsMode === 'fixed' && (
              <input
                type="range"
                className="ec-slider"
                min={2}
                max={50}
                value={slotsMax}
                onChange={(e) => setSlotsMax(parseInt(e.target.value, 10))}
              />
            )}
          </section>

          {/* Validation */}
          <section className="ec-section">
            <label className="ec-label">Mode d'inscription</label>
            <div className="ec-toggle-row" onClick={() => setValidationMode(validationMode === 'manual' ? 'free' : 'manual')}>
              <div>
                <div className="ec-toggle-title">
                  {validationMode === 'manual' ? 'Validation manuelle' : 'Inscription libre'}
                </div>
                <div className="ec-toggle-help">
                  {validationMode === 'manual'
                    ? 'Tu vois chaque demande avant d\'accepter'
                    : 'Chacun rejoint sans demander, jusqu\'à ce que ce soit complet'}
                </div>
              </div>
              <div className={`ec-toggle-switch${validationMode === 'free' ? ' is-off' : ''}`} />
            </div>
          </section>

          {error && <div className="ec-error">{error}</div>}
        </div>

        <footer className="expedition-creator-footer">
          <button className="ec-secondary-btn" onClick={onClose}>Annuler</button>
          <button
            className="ec-primary-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Publication…' : "Publier l'expédition"}
          </button>
        </footer>
      </div>
    </div>
  )
}

function translateError(err?: string): string {
  switch (err) {
    case 'max_active_voyages_reached':
      return 'Tu as déjà 3 expéditions actives. Termine ou annule d\'abord.'
    case 'rdv_must_be_in_future':
      return 'La date du RDV doit être dans le futur.'
    case 'unauthenticated':
      return 'Tu n\'es pas connecté.'
    default:
      return err ? `Erreur : ${err}` : 'Erreur inconnue'
  }
}
