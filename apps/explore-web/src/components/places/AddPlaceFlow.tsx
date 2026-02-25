import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/imageUtils'
import { useMapStore } from '../../stores/mapStore'
import { useFogStore } from '../../stores/fogStore'
import { useToastStore } from '../../stores/toastStore'

type Step = 'location' | 'form' | 'submitting' | 'success'

interface Tag {
  id: string
  title: string
  color: string
  background: string
  icon: string | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

export function AddPlaceFlow() {
  const [step, setStep] = useState<Step>('location')
  const [title, setTitle] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null)
  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [coordsFocused, setCoordsFocused] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const coords = useMapStore(s => s.pendingNewPlaceCoords)
  const setAddPlaceMode = useMapStore(s => s.setAddPlaceMode)
  const userId = useFogStore(s => s.userId)
  const userPosition = useFogStore(s => s.userPosition)

  // Fetch tags au montage
  useEffect(() => {
    supabase
      .from('tags')
      .select('id, title, color, background, icon')
      .order('order')
      .then(({ data }) => {
        if (data) setTags(data as Tag[])
      })
  }, [])

  function handleClose() {
    setAddPlaceMode(false)
  }

  // Sync inputs GPS depuis le centre de la carte (sauf si l'utilisateur édite)
  useEffect(() => {
    if (coords && !coordsFocused) {
      setLatInput(coords.lat.toFixed(5))
      setLngInput(coords.lng.toFixed(5))
    }
  }, [coords, coordsFocused])

  function handleGPS() {
    if (userPosition) {
      useMapStore.getState().requestFlyTo({ lng: userPosition.lng, lat: userPosition.lat })
    }
  }

  function handleCoordsSubmit() {
    const lat = parseFloat(latInput)
    const lng = parseFloat(lngInput)
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      useMapStore.getState().requestFlyTo({ lng, lat })
      setCoordsFocused(false)
    }
  }

  function handleConfirmLocation() {
    if (!coords) return
    setStep('form')
    // Reverse geocoding pour pré-remplir l'adresse
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&accept-language=fr`)
      .then(r => r.json())
      .then(data => {
        if (data?.display_name && !address) {
          setAddress(data.display_name)
        }
      })
      .catch(() => {})
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    // Filtrer les fichiers > 10 Mo
    const tooLarge = files.filter(f => f.size > MAX_FILE_SIZE)
    const valid = files.filter(f => f.size <= MAX_FILE_SIZE)
    if (tooLarge.length > 0) {
      setError(`${tooLarge.length} fichier(s) dépassent 10 Mo et ont été ignorés.`)
    }
    if (!valid.length) { e.target.value = ''; return }

    setPhotoFiles(prev => [...prev, ...valid])
    const urls = valid.map(f => URL.createObjectURL(f))
    setPhotoPreviews(prev => [...prev, ...urls])
    // Reset input pour pouvoir resélectionner le même fichier
    e.target.value = ''
  }

  function handleRemovePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index])
    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    setPhotoFiles(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(dragIndex, 1)
      arr.splice(index, 0, moved)
      return arr
    })
    setPhotoPreviews(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(dragIndex, 1)
      arr.splice(index, 0, moved)
      return arr
    })
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleToggleTag(tagId: string) {
    setSelectedTagIds(prev => {
      if (prev.includes(tagId)) return prev.filter(id => id !== tagId)
      if (prev.length >= 3) return prev // Max 3 tags
      return [...prev, tagId]
    })
  }

  function handleBackToLocation() {
    setStep('location')
    setError(null)
  }

  async function handleSubmit() {
    if (!userId || !coords || photoFiles.length === 0 || selectedTagIds.length === 0 || !title.trim()) return
    setStep('submitting')
    setError(null)

    try {
      // 1. Compress & upload toutes les photos (full + thumb)
      const imageEntries: { id: string; url: string; thumb: string }[] = []

      for (const file of photoFiles) {
        const [compressed, thumbnail] = await Promise.all([
          compressImage(file),
          compressImage(file, 400),
        ])
        const imageId = crypto.randomUUID()
        const fullPath = `places/${userId}/${imageId}.webp`
        const thumbPath = `places/${userId}/${imageId}_thumb.webp`

        const [fullUpload, thumbUpload] = await Promise.all([
          supabase.storage.from('place-images').upload(fullPath, compressed, { contentType: 'image/webp', upsert: false }),
          supabase.storage.from('place-images').upload(thumbPath, thumbnail, { contentType: 'image/webp', upsert: false }),
        ])

        if (fullUpload.error) {
          setError(`Upload: ${fullUpload.error.message}`)
          setStep('form')
          return
        }

        const { data: fullUrl } = supabase.storage.from('place-images').getPublicUrl(fullPath)
        const thumbUrl = thumbUpload.error
          ? fullUrl.publicUrl
          : supabase.storage.from('place-images').getPublicUrl(thumbPath).data.publicUrl

        imageEntries.push({ id: imageId, url: fullUrl.publicUrl, thumb: thumbUrl })
      }

      // 2. Create place via RPC (première photo + premier tag)
      const { data, error: rpcError } = await supabase.rpc('create_place', {
        p_user_id: userId,
        p_title: title.trim(),
        p_latitude: coords.lat,
        p_longitude: coords.lng,
        p_tag_id: selectedTagIds[0],
        p_image_url: imageEntries[0].url,
        p_thumb_url: imageEntries[0].thumb,
        p_address: address.trim(),
        p_text: description.trim(),
      })

      if (rpcError) {
        setError(rpcError.message)
        setStep('form')
        return
      }

      if (data?.error) {
        setError(data.error)
        setStep('form')
        return
      }

      const placeId = data.placeId as string

      // 3. Si plusieurs photos, mettre à jour le JSONB images
      if (imageEntries.length > 1) {
        await supabase
          .from('places')
          .update({ images: imageEntries })
          .eq('id', placeId)
      }

      // 4. Si plusieurs tags, insérer les tags secondaires
      if (selectedTagIds.length > 1) {
        const secondaryTags = selectedTagIds.slice(1).map(tagId => ({
          place_id: placeId,
          tag_id: tagId,
          is_primary: false,
        }))
        await supabase.from('place_tags').insert(secondaryTags)
      }

      // 5. Optimistic updates
      setNewPlaceId(placeId)
      useFogStore.getState().addDiscoveredId(placeId)
      useMapStore.getState().incrementPlacesRefreshKey()

      // 6. Toast
      useToastStore.getState().addToast({
        type: 'new_place',
        message: `Lieu "${title.trim()}" ajouté !`,
        timestamp: Date.now(),
        placeId,
        placeLocation: { latitude: coords.lat, longitude: coords.lng },
      })

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('form')
    }
  }

  function handleViewPlace() {
    if (!newPlaceId || !coords) return
    useMapStore.getState().requestFlyTo({ lng: coords.lng, lat: coords.lat, placeId: newPlaceId })
    handleClose()
  }

  function handleAddAnother() {
    setTitle('')
    setPhotoFiles([])
    setPhotoPreviews([])
    setSelectedTagIds([])
    setAddress('')
    setDescription('')
    setError(null)
    setNewPlaceId(null)
    setStep('location')
  }

  const canSubmit = title.trim().length > 0 && photoFiles.length > 0 && selectedTagIds.length > 0

  // ===== STEP 1 : Location =====
  if (step === 'location') {
    return (
      <>
        {/* Top bar */}
        <div className="add-place-top-bar">
          <button className="add-place-back-btn" onClick={handleClose}>
            &#8592; Retour
          </button>
          <span className="add-place-step-title">Placer un lieu</span>
          <button
            className="add-place-next-btn"
            onClick={handleConfirmLocation}
            disabled={!coords}
          >
            Placer ici
          </button>
        </div>

        {/* Crosshair */}
        <div className="add-place-crosshair">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            {/* Bordures blanches (ombre) */}
            <circle cx="24" cy="24" r="20" stroke="#ffffff" strokeWidth="6" strokeDasharray="4 3" opacity="0.6" />
            <circle cx="24" cy="24" r="7" fill="#ffffff" opacity="0.6" />
            <line x1="24" y1="0" x2="24" y2="16" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
            <line x1="24" y1="32" x2="24" y2="48" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
            <line x1="0" y1="24" x2="16" y2="24" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
            <line x1="32" y1="24" x2="48" y2="24" stroke="#ffffff" strokeWidth="6" opacity="0.5" />
            {/* Traits principaux */}
            <circle cx="24" cy="24" r="20" stroke="#4A3728" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
            <circle cx="24" cy="24" r="4" fill="#4A3728" />
            <line x1="24" y1="0" x2="24" y2="16" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
            <line x1="24" y1="32" x2="24" y2="48" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
            <line x1="0" y1="24" x2="16" y2="24" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
            <line x1="32" y1="24" x2="48" y2="24" stroke="#4A3728" strokeWidth="2" opacity="0.8" />
          </svg>
        </div>

        {/* Bottom bar */}
        <div className="add-place-bottom-bar">
          <button className="add-place-gps-btn" onClick={handleGPS} disabled={!userPosition}>
            {'\uD83D\uDCCD'} Ma position
          </button>
          <div className="add-place-coords-inputs">
            <label className="add-place-coord-label">Lat</label>
            <input
              className="add-place-coord-input"
              type="text"
              inputMode="decimal"
              value={latInput}
              onChange={e => setLatInput(e.target.value)}
              onFocus={() => setCoordsFocused(true)}
              onBlur={() => { setCoordsFocused(false); handleCoordsSubmit() }}
              onKeyDown={e => { if (e.key === 'Enter') { handleCoordsSubmit(); (e.target as HTMLInputElement).blur() } }}
              placeholder="43.7000"
            />
            <label className="add-place-coord-label">Lng</label>
            <input
              className="add-place-coord-input"
              type="text"
              inputMode="decimal"
              value={lngInput}
              onChange={e => setLngInput(e.target.value)}
              onFocus={() => setCoordsFocused(true)}
              onBlur={() => { setCoordsFocused(false); handleCoordsSubmit() }}
              onKeyDown={e => { if (e.key === 'Enter') { handleCoordsSubmit(); (e.target as HTMLInputElement).blur() } }}
              placeholder="7.2600"
            />
          </div>
        </div>
      </>
    )
  }

  // ===== STEP 2 : Form =====
  if (step === 'form') {
    return (
      <div className="add-place-form">
        <div className="add-place-form-header">
          <button className="add-place-back-btn" onClick={handleBackToLocation}>
            &#8592; Retour
          </button>
          <span className="add-place-step-title">Nouveau lieu</span>
          <div style={{ width: 80 }} />
        </div>

        <div className="add-place-form-body">
          {error && <div className="add-place-error">{error}</div>}

          {/* Titre */}
          <label className="add-place-label">
            Nom du lieu <span className="add-place-required">*</span>
          </label>
          <input
            className="add-place-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Chapelle Saint-Martin"
            maxLength={255}
            autoFocus
          />

          {/* Photos */}
          <label className="add-place-label">
            Photos <span className="add-place-required">*</span>
            {photoPreviews.length > 0 && (
              <span className="add-place-optional"> ({photoPreviews.length})</span>
            )}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            style={{ display: 'none' }}
          />
          {photoPreviews.length > 0 ? (
            <div className="add-place-photos-grid">
              {photoPreviews.map((url, i) => (
                <div
                  key={url}
                  className={`add-place-photo-thumb${dragIndex === i ? ' dragging' : ''}${dragOverIndex === i ? ' drag-over' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={e => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                >
                  <img src={url} alt={`Photo ${i + 1}`} draggable={false} />
                  {i === 0 && <span className="add-place-photo-main">Principale</span>}
                  <button
                    className="add-place-photo-remove"
                    onClick={() => handleRemovePhoto(i)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <button
                className="add-place-photo-add-more"
                onClick={() => fileInputRef.current?.click()}
              >
                +
              </button>
            </div>
          ) : (
            <button className="add-place-photo-btn" onClick={() => fileInputRef.current?.click()}>
              {'\uD83D\uDCF7'} Ajouter des photos
            </button>
          )}

          {/* Tags (multi-sélection ordonnée) */}
          <label className="add-place-label">
            Type de lieu <span className="add-place-required">*</span>
            <span className="add-place-optional"> (le 1er = principal)</span>
          </label>
          <div className="add-place-tag-scroll">
            {tags.map(tag => {
              const orderIndex = selectedTagIds.indexOf(tag.id)
              const isSelected = orderIndex !== -1
              return (
                <button
                  key={tag.id}
                  className={`add-place-tag-pill${isSelected ? ' selected' : ''}`}
                  style={{
                    color: tag.color,
                    background: tag.background,
                  }}
                  onClick={() => handleToggleTag(tag.id)}
                >
                  {isSelected && (
                    <span className="add-place-tag-order">{orderIndex + 1}</span>
                  )}
                  {tag.icon && (
                    <span
                      className="add-place-tag-icon"
                      style={{
                        WebkitMaskImage: `url(${tag.icon})`,
                        maskImage: `url(${tag.icon})`,
                      }}
                    />
                  )}
                  {tag.title}
                </button>
              )
            })}
          </div>

          {/* Adresse (optionnel) */}
          <label className="add-place-label">Adresse <span className="add-place-optional">(optionnel)</span></label>
          <input
            className="add-place-input"
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Ex: 12 rue du Chateau, 06000 Nice"
          />

          {/* Description (optionnel) */}
          <label className="add-place-label">Description <span className="add-place-optional">(optionnel)</span></label>
          <textarea
            className="add-place-textarea"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Racontez l'histoire de ce lieu..."
            rows={3}
          />
        </div>

        <div className="add-place-form-footer">
          <button className="add-place-cancel-btn" onClick={handleBackToLocation}>
            Annuler
          </button>
          <button
            className="add-place-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Créer le lieu
          </button>
        </div>
      </div>
    )
  }

  // ===== STEP 3 : Submitting =====
  if (step === 'submitting') {
    return (
      <div className="add-place-form">
        <div className="add-place-loading">
          <div className="add-place-spinner" />
          <span>Création du lieu...</span>
        </div>
      </div>
    )
  }

  // ===== STEP 4 : Success =====
  return (
    <div className="add-place-form">
      <div className="add-place-success">
        <div className="add-place-success-icon">{'\u2728'}</div>
        <h2 className="add-place-success-title">Lieu ajouté !</h2>
        <p className="add-place-success-text">
          Votre lieu apparaît maintenant sur la carte.
        </p>
        <div className="add-place-success-actions">
          <button className="add-place-submit-btn" onClick={handleViewPlace}>
            Voir le lieu
          </button>
          <button className="add-place-cancel-btn" onClick={handleAddAnother}>
            Ajouter un autre
          </button>
        </div>
      </div>
    </div>
  )
}
