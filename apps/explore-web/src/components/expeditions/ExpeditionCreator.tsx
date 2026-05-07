import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  createExpedition,
  updateExpedition,
  updateExpeditionCall,
  uploadExpeditionCover,
} from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { listUpcomingExpeditions, getExpeditionCoverUrl } from '../../lib/expeditionsApi'
import { useMapStore } from '../../stores/mapStore'
import type { ExpeditionDetail } from '../../types/expedition'
import './ExpeditionCreator.css'

interface Props {
  onClose: () => void
  onCreated: (expeditionId: string) => void
  /** Coordonnées initiales (ex : centre de la carte au moment de l'ouverture). */
  initialLat?: number
  initialLng?: number
  /** Si fourni, le composant passe en mode édition de cette expé existante. */
  existing?: ExpeditionDetail
  /** Si true, le composant se rend inline sans overlay/portal (pour
   *  l'édition depuis la modale ExpeditionModal). */
  embedded?: boolean
}

/**
 * Formulaire de création d'une expédition.
 * V1 : un seul écran scrollable (pas de stepper multi-page).
 * Le tap-on-map sera V1.5 — pour l'instant, lat/lng saisis manuellement
 * avec un bouton "ma position actuelle".
 */
export function ExpeditionCreator({ onClose, onCreated, initialLat, initialLng, existing, embedded }: Props) {
  const isEdit = !!existing
  const setUpcoming = useExpeditionsStore((s) => s.setUpcoming)

  const [name, setName] = useState(existing?.name ?? '')
  const [callText, setCallText] = useState(existing?.call_text ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(
    existing?.cover_image_url ? getExpeditionCoverUrl(existing.cover_image_url) : null,
  )
  const [rdvAt, setRdvAt] = useState(() => {
    if (existing?.rdv_at) {
      // ISO → format datetime-local
      return new Date(existing.rdv_at).toISOString().slice(0, 16)
    }
    const d = new Date()
    d.setDate(d.getDate() + 7)
    d.setHours(9, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [rdvUnset, setRdvUnset] = useState(existing ? existing.rdv_at === null : false)
  const [rdvLat, setRdvLat] = useState<number | null>(existing?.rdv_lat ?? initialLat ?? null)
  const [rdvLng, setRdvLng] = useState<number | null>(existing?.rdv_lng ?? initialLng ?? null)
  const [rdvLabel, setRdvLabel] = useState(existing?.rdv_label ?? '')
  const [slotsMode, setSlotsMode] = useState<'fixed' | 'open'>(existing?.slots_open ? 'open' : 'fixed')
  const [slotsMax, setSlotsMax] = useState(existing?.slots_max ?? 5)
  const [validationMode, setValidationMode] = useState<'manual' | 'free'>(existing?.validation_mode ?? 'manual')
  // Décharge de responsabilité — obligatoire à la création (déjà acceptée si édition).
  const [liabilityAccepted, setLiabilityAccepted] = useState(!!existing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─────────── Tap-on-map ───────────
  const [pickingPin, setPickingPin] = useState(false)
  const expeditionPinResult = useMapStore((s) => s.expeditionPinResult)

  useEffect(() => {
    if (pickingPin && expeditionPinResult) {
      setRdvLat(expeditionPinResult.lat)
      setRdvLng(expeditionPinResult.lng)
      setPickingPin(false)
      useMapStore.getState().setExpeditionPinResult(null)
    }
  }, [pickingPin, expeditionPinResult])

  function onPickOnMap() {
    useMapStore.getState().setExpeditionPinResult(null)
    useMapStore.getState().setExpeditionPinMode(true)
    setPickingPin(true)
  }

  function cancelPickPin() {
    useMapStore.getState().setExpeditionPinMode(false)
    setPickingPin(false)
  }

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Choisis une image'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image trop lourde (10 Mo max)'); return }
    setError(null)
    setCoverFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }
  function clearCover() {
    setCoverFile(null)
    setCoverPreview(null)
  }

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
    if (!isEdit && !liabilityAccepted) {
      setError('Tu dois accepter la décharge de responsabilité pour publier.')
      return
    }
    let rdvAtIso: string | null = null
    if (!rdvUnset) {
      const rdvDate = new Date(rdvAt)
      if (Number.isNaN(rdvDate.getTime()) || rdvDate.getTime() <= Date.now()) {
        setError('La date du RDV doit être dans le futur'); return
      }
      rdvAtIso = rdvDate.toISOString()
    }

    setSubmitting(true)
    let expeditionId: string
    if (isEdit && existing) {
      // Mode édition — update_voyage (qui ne touche pas call_text ni cover)
      const r = await updateExpedition(existing.id, {
        name: name.trim(),
        description: description.trim() || null,
        rdv_at: rdvAtIso,
        rdv_lat: rdvLat,
        rdv_lng: rdvLng,
        rdv_label: rdvLabel.trim() || null,
        slots_max: slotsMode === 'fixed' ? slotsMax : null,
        slots_open: slotsMode === 'open',
      })
      if (!r.success) {
        setSubmitting(false)
        setError(translateError(r.error))
        return
      }
      expeditionId = existing.id
    } else {
      const r = await createExpedition({
        name: name.trim(),
        description: description.trim() || null,
        rdv_at: rdvAtIso,
        rdv_lat: rdvLat,
        rdv_lng: rdvLng,
        rdv_label: rdvLabel.trim() || null,
        slots_max: slotsMode === 'fixed' ? slotsMax : null,
        slots_open: slotsMode === 'open',
        validation_mode: validationMode,
      })
      if (!r.success || !r.expedition_id) {
        setSubmitting(false)
        setError(translateError(r.error))
        return
      }
      expeditionId = r.expedition_id
    }

    // L'appel — mise à jour si fourni (ou si modifié en édition)
    const trimmedCall = callText.trim() || null
    if (!isEdit ? trimmedCall : trimmedCall !== existing?.call_text) {
      await updateExpeditionCall(expeditionId, trimmedCall)
    }
    // Image cover — upload si nouveau fichier choisi
    if (coverFile) {
      await uploadExpeditionCover(expeditionId, coverFile)
    }
    setSubmitting(false)

    listUpcomingExpeditions().then(setUpcoming).catch(() => {})
    onCreated(expeditionId)
  }

  if (pickingPin) {
    return createPortal(
      <div className="ec-pin-picker-banner">
        <div className="ec-pin-picker-text">
          <span className="ec-pin-picker-icon">👆</span>
          Tape sur la carte pour placer le point de RDV
        </div>
        <button type="button" className="ec-pin-picker-cancel" onClick={cancelPickPin}>
          Annuler
        </button>
      </div>,
      document.body,
    )
  }

  const header = !embedded ? (
    <header className="expedition-creator-header">
      <div>
        <div className="expedition-creator-eyebrow">Nouvel événement</div>
        <h2 className="expedition-creator-title">{isEdit ? 'Modifier l\'événement' : 'Convoque tes compagnons'}</h2>
      </div>
      <button className="expedition-creator-close" onClick={onClose} aria-label="Fermer">×</button>
    </header>
  ) : null

  const formContent = (
    <>
      {header}

      {/* Esprit Rune de Chêne — quel type d'événement, quelle mentalité.
          Pattern visuel aligné sur "Règles de l'explorateur érudit"
          (ExpeditionModal section bienséance). N'apparaît qu'à la création. */}
      {!isEdit && (
        <section className="expedition-creator-spirit">
          <h3>L'esprit Rune de Chêne</h3>
          <div className="ec-spirit-grid">
            <div className="ec-spirit-rule">
              <span className="ec-spirit-icon">🤝</span>
              <div>
                <strong>Une rencontre, une quête, une proposition culturelle</strong>
                <small>Bivouac, aventure, balade, conte au feu, atelier, banquet, événement culturel…</small>
              </div>
            </div>
            <div className="ec-spirit-rule">
              <span className="ec-spirit-icon">🌳</span>
              <div>
                <strong>Toujours en lien</strong>
                <small>Histoire, patrimoine, Nature — l'esprit Runes de Chêne doit transparaître. Pas d'auto-promotion sans un lien avec l'esprit de la marque.</small>
              </div>
            </div>
            <div className="ec-spirit-rule">
              <span className="ec-spirit-icon">📜</span>
              <div>
                <strong>Tu transmets, tu invites</strong>
                <small>Pas un cours magistral. Une curiosité partagée, une envie de partir à l'aventure ou de transmettre.</small>
              </div>
            </div>
            <div className="ec-spirit-rule">
              <span className="ec-spirit-icon">🪶</span>
              <div>
                <strong>L'esprit du chevalier errant</strong>
                <small>Camaraderie, honneur, bienveillance & sécurité. Vous êtes responsables de vous même, et des personnes qui vous font confiance.</small>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="expedition-creator-body">
          <div className="ec-col ec-col-identity">

          {/* Image de couverture (optionnelle) */}
          <section className="ec-section">
            <label className="ec-label">Image de l'événement <span style={{ textTransform: 'none', letterSpacing: 0, color: '#8a7050', fontWeight: 400 }}>(10 Mo max)</span></label>
            {coverPreview ? (
              <div className="ec-cover-preview">
                <img src={coverPreview} alt="" />
                <button type="button" className="ec-cover-remove" onClick={clearCover} aria-label="Retirer">×</button>
              </div>
            ) : (
              <label className="ec-cover-picker">
                <input type="file" accept="image/*" onChange={handleCoverSelect} hidden />
                <span>📷 Choisir une image</span>
                <small>Sinon, ton avatar sera utilisé sur la carte</small>
              </label>
            )}
          </section>

          {/* Nom */}
          <section className="ec-section">
            <label className="ec-label">Nom de l'événement</label>
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

          {/* L'appel */}
          <section className="ec-section">
            <label className="ec-label">L'appel <span style={{ textTransform: 'none', letterSpacing: 0, color: '#8a7050', fontWeight: 400 }}>(optionnel)</span></label>
            <input
              type="text"
              className="ec-input"
              placeholder="« Une nuit pour faire le silence avec ses propres pas. »"
              value={callText}
              maxLength={200}
              onChange={(e) => setCallText(e.target.value)}
            />
            <div className="ec-counter">{callText.length} / 200</div>
          </section>

          {/* Lieu (Point de ralliement) */}
          <section className="ec-section">
            <label className="ec-label">Point de ralliement</label>
            <div className="ec-pin-status">
              {rdvLat != null && rdvLng != null ? (
                <span>📍 {rdvLat.toFixed(4)}, {rdvLng.toFixed(4)}</span>
              ) : (
                <span style={{ color: '#a14a2a' }}>Aucun point choisi</span>
              )}
            </div>
            <button type="button" className="ec-secondary-btn" onClick={onPickOnMap}>
              🗺️ {rdvLat != null ? 'Changer le point sur la carte' : 'Choisir sur la carte'}
            </button>
            <button type="button" className="ec-secondary-btn" onClick={useCurrentPosition} style={{ marginTop: 6 }}>
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

          </div>{/* /ec-col-identity */}

          <div className="ec-col ec-col-rdv">

          {/* Description (en haut de la col droite, plus de hauteur) */}
          <section className="ec-section ec-section-grow">
            <label className="ec-label">Description <span style={{ textTransform: 'none', letterSpacing: 0, color: '#8a7050', fontWeight: 400 }}>(optionnelle)</span></label>
            <textarea
              className="ec-textarea ec-textarea-tall"
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
              disabled={rdvUnset}
              style={rdvUnset ? { opacity: 0.5 } : undefined}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: 14, color: '#6e5435' }}>
              <input
                type="checkbox"
                checked={rdvUnset}
                onChange={(e) => setRdvUnset(e.target.checked)}
              />
              À définir plus tard avec les compagnons
            </label>
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
            {slotsMode === 'fixed' && (() => {
              const pct = ((slotsMax - 2) / (50 - 2)) * 100
              return (
                <input
                  type="range"
                  className="ec-slider"
                  min={2}
                  max={50}
                  value={slotsMax}
                  onChange={(e) => setSlotsMax(parseInt(e.target.value, 10))}
                  style={{
                    background: `linear-gradient(90deg, #a14a2a 0%, #a14a2a ${pct}%, #ecdcb8 ${pct}%, #ecdcb8 100%)`,
                  }}
                />
              )
            })()}
          </section>

          {/* Validation — création seulement (update_voyage ne change pas ce champ) */}
          {!isEdit && (
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
          )}

          </div>{/* /ec-col-rdv */}

          {error && <div className="ec-error ec-error-full">{error}</div>}
        </div>

        <footer className="expedition-creator-footer">
          <div className="ec-footer-stack">
            {!isEdit && (
              <label className="ec-liability">
                <input
                  type="checkbox"
                  checked={liabilityAccepted}
                  onChange={(e) => setLiabilityAccepted(e.target.checked)}
                />
                <span>
                  Je comprends que Rune de Chêne ne peut être tenue responsable de l'événement que je propose et de tous ceux qui pourraient s'en suivre.
                </span>
              </label>
            )}
            <button
              className="ec-primary-btn"
              onClick={handleSubmit}
              disabled={submitting || (!isEdit && !liabilityAccepted)}
            >
              {submitting ? (isEdit ? 'Enregistrement…' : 'Publication…') : (isEdit ? 'Enregistrer les modifications' : "Publier l'événement")}
            </button>
          </div>
        </footer>
    </>
  )

  if (embedded) {
    return (
      <div className="expedition-creator expedition-creator-embedded">
        {formContent}
      </div>
    )
  }

  return createPortal(
    <div className="expedition-creator-overlay" onClick={onClose}>
      <div className="expedition-creator" onClick={(e) => e.stopPropagation()}>
        {formContent}
      </div>
    </div>,
    document.body,
  )
}

function translateError(err?: string): string {
  switch (err) {
    case 'max_active_voyages_reached':
      return 'Tu as déjà 3 événements actifs. Termine ou annule d\'abord.'
    case 'rdv_must_be_in_future':
      return 'La date du RDV doit être dans le futur.'
    case 'unauthenticated':
      return 'Tu n\'es pas connecté.'
    default:
      return err ? `Erreur : ${err}` : 'Erreur inconnue'
  }
}
