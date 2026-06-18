import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { compressImage } from '../../../lib/imageUtils'
import { useMapStore } from '../../../stores/mapStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useToastStore } from '../../../stores/toastStore'
import { useGloryRulesStore } from '../../../stores/gloryRulesStore'
import { useDefisStore } from '../../../stores/defisStore'
import { refreshLevelStateGlobal } from '../../../hooks/useLevel'
import { refreshGloryGlobal } from '../../../hooks/useGlory'
import { useGpsMarksStore } from '../../../stores/gpsMarksStore'
import { findNearbyPlaces, publishGpsMark } from '../../../lib/gpsMarksApi'
import type { NearbyPlace } from '../../../types/gpsMark'
import { EraSelector } from './EraSelector'
import { MapCrosshairPicker } from '../shared/MapCrosshairPicker'
import './AddPlaceFlow.css'

type Step = 'location' | 'form' | 'submitting' | 'success'

interface Tag {
  id: string
  title: string
  color: string
  background: string
  icon: string | null
}

/** Photo déjà compressée en mémoire (webp), prête à uploader.
 *  On compresse dès la sélection (pas au submit) pour lire le File pendant
 *  que le grant du picker mobile est encore frais — sinon, sur Android, l'URI
 *  content:// peut être révoquée le temps de remplir le formulaire et la
 *  lecture échoue avec NotReadableError ("Failed to read file"). */
interface PreparedPhoto {
  full: File
  thumb: File
  preview: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

/**
 * V0.7.6 (8/05) — récupère une position GPS fraîche pour le check serveur,
 * fallback silencieux sur null. Le store userPosition peut être stale ou
 * absent (notamment au premier rendu après login), ce qui faisait échouer
 * silencieusement l'auto-plant pour des users physiquement sur place.
 */
async function getFreshPosition(timeoutMs = 5000): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.sin(dLng / 2) ** 2 * Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function AddPlaceFlow() {
  const [step, setStep] = useState<Step>('location')
  const [title, setTitle] = useState('')
  const [photos, setPhotos] = useState<PreparedPhoto[]>([])
  const [preparingPhotos, setPreparingPhotos] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [rewards, setRewards] = useState<{ permanentInfluence: number; explorationGain: number; contentPoints: number; isExplorer: boolean; isGps: boolean } | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [newPlaceId, setNewPlaceId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [confirmedCoords, setConfirmedCoords] = useState<{ lng: number; lat: number } | null>(null)
  const [charterChecks, setCharterChecks] = useState([false, false, false])
  // V0.7.13 (11/05) — default 'unknown' (Indéfinie) pour ne plus bloquer le
  // create si l'utilisateur ne connaît pas l'époque. cf. mig 165.
  const [eraId, setEraId] = useState<string | null>('unknown')
  const [yearExact, setYearExact] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const setAddPlaceMode = useMapStore(s => s.setAddPlaceMode)
  const userId = usePlayerStore(s => s.userId)
  const userPosition = usePlayerStore(s => s.userPosition)

  // === Mode "publication d'une marque GPS" (brouillon de lieu) ===
  const publishingDraft = useMapStore(s => s.publishingDraft)
  const setPublishingDraft = useMapStore(s => s.setPublishingDraft)
  const [nearby, setNearby] = useState<NearbyPlace[]>([])
  const [mergeChoice, setMergeChoice] = useState<string | null>(null) // placeId, ou 'new', ou null
  const [draftImages, setDraftImages] = useState<{ id: string; url: string; thumb: string }[]>([])

  // Fetch tags au montage
  useEffect(() => {
    supabase
      .from('tags')
      .select('id, title, color, background, icon')
      .order('order')
      .then(({ data, error }) => {
        if (error) {
          console.error('[AddPlaceFlow] load tags failed', error)
          return
        }
        if (data) setTags(data as Tag[])
      })
  }, [])

  // Pré-remplissage depuis la marque GPS (une seule fois quand publishingDraft est posé).
  const draftPrefillDoneRef = useRef(false)
  useEffect(() => {
    if (draftPrefillDoneRef.current || !publishingDraft) return
    draftPrefillDoneRef.current = true
    setConfirmedCoords({ lat: publishingDraft.latitude, lng: publishingDraft.longitude })
    if (publishingDraft.title) setTitle(publishingDraft.title)
    setDraftImages(publishingDraft.images)
    setStep('form')
    useMapStore.getState().requestFlyTo({ lng: publishingDraft.longitude, lat: publishingDraft.latitude })
  }, [publishingDraft])

  // Détection de collision : lieux existants à proximité de la marque.
  useEffect(() => {
    if (!publishingDraft || step !== 'form') return
    let cancelled = false
    void (async () => {
      const r = await findNearbyPlaces(publishingDraft.latitude, publishingDraft.longitude, 30)
      if (!cancelled) setNearby(r)
    })()
    return () => { cancelled = true }
  }, [publishingDraft, step])

  function handleClose() {
    setPublishingDraft(null)
    setAddPlaceMode(false)
  }

  // V0.7.6 (8/05) — Au mount, recentre la carte sur la position GPS de l'user.
  // Sinon le viseur reste là où la carte était centrée avant (souvent loin),
  // et l'user peut valider sans réaliser que le pin n'est pas chez lui.
  // Si l'user veut ajouter à distance (lieu vu en vacances, etc.), il peut
  // toujours bouger la carte après. Ne déclenche le fly-to qu'une fois au mount
  // (ref + flag pour ne pas répéter à chaque update de userPosition).
  const initialFlyToDoneRef = useRef(false)
  useEffect(() => {
    if (initialFlyToDoneRef.current) return
    if (!userPosition) return
    initialFlyToDoneRef.current = true
    useMapStore.getState().requestFlyTo({ lng: userPosition.lng, lat: userPosition.lat })
  }, [userPosition])

  function handleConfirmLocation(confirmed: { lat: number; lng: number }) {
    setConfirmedCoords({ lng: confirmed.lng, lat: confirmed.lat })
    setStep('form')
    // Reverse geocoding — toujours mettre à jour l'adresse
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${confirmed.lat}&lon=${confirmed.lng}&format=json&accept-language=fr`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        if (data?.display_name) setAddress(data.display_name)
      })
      .catch(err => console.warn('[AddPlaceFlow] reverse-geocoding failed', err))
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    // Reset input tout de suite (avant tout await) pour pouvoir resélectionner
    // le même fichier, et capturer la liste de manière synchrone.
    e.target.value = ''
    if (!files.length) return

    // Filtrer les fichiers > 10 Mo
    const tooLarge = files.filter(f => f.size > MAX_FILE_SIZE)
    const valid = files.filter(f => f.size <= MAX_FILE_SIZE)
    if (!valid.length) {
      if (tooLarge.length > 0) setError(`${tooLarge.length} fichier(s) dépassent 10 Mo et ont été ignorés.`)
      return
    }

    // Compression immédiate (full 1920 + thumb 400) : on lit le File pendant
    // que le grant du picker est frais. Une photo illisible est signalée ici,
    // pas après que l'user a rempli tout le formulaire.
    setPreparingPhotos(true)
    setError(null)
    const prepared: PreparedPhoto[] = []
    let failed = 0
    for (const file of valid) {
      try {
        const [full, thumb] = await Promise.all([
          compressImage(file),
          compressImage(file, 400),
        ])
        prepared.push({ full, thumb, preview: URL.createObjectURL(full) })
      } catch {
        failed++
      }
    }
    if (prepared.length) setPhotos(prev => [...prev, ...prepared])

    const msgs: string[] = []
    if (tooLarge.length > 0) msgs.push(`${tooLarge.length} fichier(s) dépassent 10 Mo et ont été ignorés.`)
    if (failed > 0) msgs.push(`${failed} photo(s) n'ont pas pu être lues sur ton téléphone — re-sélectionne-les.`)
    setError(msgs.length ? msgs.join(' ') : null)
    setPreparingPhotos(false)
  }

  function handleRemovePhoto(index: number) {
    URL.revokeObjectURL(photos[index].preview)
    setPhotos(prev => prev.filter((_, i) => i !== index))
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
    setPhotos(prev => {
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
    setConfirmedCoords(null)
    setStep('location')
    setError(null)
  }

  async function handleSubmit() {
    // === Branche publication d'une marque GPS ===
    if (publishingDraft) {
      if (!userId || !confirmedCoords || !title.trim() || selectedTagIds.length === 0) return
      if ((photos.length + draftImages.length) === 0) return
      setStep('submitting'); setError(null)
      try {
        const newImages: { id: string; url: string; thumb: string }[] = []
        for (const photo of photos) {
          const imageId = crypto.randomUUID()
          const fullPath = `places/${userId}/${imageId}.webp`
          const thumbPath = `places/${userId}/${imageId}_thumb.webp`
          const [fullUp, thumbUp] = await Promise.all([
            supabase.storage.from('place-images').upload(fullPath, photo.full, { contentType: 'image/webp', upsert: false }),
            supabase.storage.from('place-images').upload(thumbPath, photo.thumb, { contentType: 'image/webp', upsert: false }),
          ])
          if (fullUp.error) { setError(`Upload: ${fullUp.error.message}`); setStep('form'); return }
          const full = supabase.storage.from('place-images').getPublicUrl(fullPath).data.publicUrl
          const thumb = thumbUp.error ? full : supabase.storage.from('place-images').getPublicUrl(thumbPath).data.publicUrl
          newImages.push({ id: imageId, url: full, thumb })
        }
        const allImages = [...draftImages, ...newImages]

        const res = await publishGpsMark({
          userId, draftId: publishingDraft.id, title: title.trim(),
          latitude: confirmedCoords.lat, longitude: confirmedCoords.lng,
          tagId: selectedTagIds[0], images: allImages, address: address.trim(), text: description.trim(),
          eraId, yearExact, secondaryTagIds: selectedTagIds.slice(1),
          mergeIntoPlaceId: mergeChoice && mergeChoice !== 'new' ? mergeChoice : null,
        })
        if (res.error === 'not_enough_discoveries') {
          setError(`Tu dois avoir découvert au moins ${res.requiredDiscoveries} lieux pour publier (tu en as ${res.currentDiscoveries}).`)
          setStep('form'); return
        }
        if (res.error) { setError(res.error); setStep('form'); return }

        useGpsMarksStore.getState().removeLocal(publishingDraft.id)
        setPublishingDraft(null)
        void refreshLevelStateGlobal(userId)
        refreshGloryGlobal()
        if (res.placeId) {
          setNewPlaceId(res.placeId)
          usePlayerStore.getState().addDiscoveredId(res.placeId)
          useMapStore.getState().incrementPlacesRefreshKey()
        }
        useDefisStore.getState().refresh(userId)
        useToastStore.getState().addToast({
          type: 'new_place',
          message: res.mode === 'merged'
            ? `📍 Visite enregistrée sur un lieu existant${res.isGps ? ' (+ bonus GPS)' : ''}.`
            : `📜 Tu as cartographié ${title.trim()}${res.isGps ? ' (+ visite GPS)' : ''}`,
          timestamp: Date.now(),
          placeId: res.placeId,
          placeLocation: { latitude: confirmedCoords.lat, longitude: confirmedCoords.lng },
        })
        setStep('success')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue'); setStep('form')
      }
      return
    }

    if (!userId || !confirmedCoords || photos.length === 0 || selectedTagIds.length === 0 || !title.trim()) return
    setStep('submitting')
    setError(null)

    try {
      // 1. Upload toutes les photos (full + thumb) — déjà compressées en webp
      // à la sélection, donc plus aucune lecture de File volatile ici.
      const imageEntries: { id: string; url: string; thumb: string }[] = []

      for (const photo of photos) {
        const imageId = crypto.randomUUID()
        const fullPath = `places/${userId}/${imageId}.webp`
        const thumbPath = `places/${userId}/${imageId}_thumb.webp`

        const [fullUpload, thumbUpload] = await Promise.all([
          supabase.storage.from('place-images').upload(fullPath, photo.full, { contentType: 'image/webp', upsert: false }),
          supabase.storage.from('place-images').upload(thumbPath, photo.thumb, { contentType: 'image/webp', upsert: false }),
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

      // V0.7.6 (8/05) — position fraîche au moment du submit. Le store
      // userPosition peut être stale ou null (premier rendu, geoloc non
      // encore renvoyée). Fallback sur store si l'OS refuse.
      const freshPos = await getFreshPosition()
      const submitPos = freshPos ?? userPosition ?? null

      // 2. Create place via RPC (toutes les photos + premier tag, atomique)
      const { data, error: rpcError } = await supabase.rpc('create_place', {
        p_user_id: userId,
        p_title: title.trim(),
        p_latitude: confirmedCoords.lat,
        p_longitude: confirmedCoords.lng,
        p_tag_id: selectedTagIds[0],
        p_images: imageEntries,
        p_address: address.trim(),
        p_text: description.trim(),
        p_carnet_title: null,
        p_user_lat: submitPos?.lat ?? null,
        p_user_lng: submitPos?.lng ?? null,
        p_era_id: eraId,
        p_year_exact: yearExact,
      })

      if (rpcError) {
        setError(rpcError.message)
        setStep('form')
        return
      }

      if (data?.error === 'not_enough_discoveries') {
        const d = data as { requiredDiscoveries: number; currentDiscoveries: number }
        setError(`Tu dois avoir découvert au moins ${d.requiredDiscoveries} lieux pour cartographier (tu en as ${d.currentDiscoveries}).`)
        setStep('form')
        return
      }

      if (data?.error) {
        setError(data.error)
        setStep('form')
        return
      }

      void refreshLevelStateGlobal(userId)
      refreshGloryGlobal() // photos de création → recompte "Photos ajoutées"
      const placeId = data.placeId as string
      if (data.rewards) setRewards({ ...(data.rewards as Record<string, unknown>), isGps: !!data.isGps } as NonNullable<typeof rewards>)

      // Auto-veille : si on a ajouté le lieu sur place GPS, on en devient
      // automatiquement le veilleur. Pas de PERFORM côté SQL — on appelle
      // plant_flag depuis le client après le succès de create_place pour ne
      // pas coupler les deux RPCs (un échec de plant_flag ne doit pas casser
      // create_place — décision Uriel 2026-05-02).
      //
      // V0.7.6 (8/05) — surface les erreurs via toast (avant : silencieux,
      // bug remonté par Tugdual qui voyait son lieu créé sans étendard sans
      // savoir pourquoi).
      if (data.isGps && submitPos) {
        const { data: plantData, error: plantErr } = await supabase.rpc('plant_flag', {
          p_user_id: userId,
          p_place_id: placeId,
          p_user_lat: submitPos.lat,
          p_user_lng: submitPos.lng,
          p_partners_user_ids: [],
        })
        if (plantErr) {
          console.warn('[AddPlaceFlow] auto plant_flag failed', plantErr)
          useToastStore.getState().addToast({
            type: 'plant_flag',
            message: `Lieu créé. Étendard non planté : ${plantErr.message}. Tu pourras réessayer depuis la fiche du lieu en t'approchant à moins de 200 m du point exact.`,
            timestamp: Date.now(),
          })
        } else if (plantData?.error === 'too_far') {
          useToastStore.getState().addToast({
            type: 'plant_flag',
            message: `Lieu créé. Tu es à ${plantData.distanceKm} km du point exact — rapproche-toi à moins de 200 m pour planter ton étendard.`,
            timestamp: Date.now(),
          })
        } else if (plantData?.error) {
          useToastStore.getState().addToast({
            type: 'plant_flag',
            message: `Lieu créé. Étendard non planté (${plantData.error}). Tu pourras réessayer depuis la fiche du lieu.`,
            timestamp: Date.now(),
          })
        }
      } else if (!data.isGps) {
        // Le serveur a calculé que le user n'est pas sur place. On informe
        // explicitement pour qu'il sache pourquoi son étendard n'apparaît pas.
        const distNote = submitPos
          ? `Tu sembles être à ${haversineKm(submitPos.lat, submitPos.lng, confirmedCoords.lat, confirmedCoords.lng).toFixed(2)} km du point exact.`
          : 'Ta position GPS n\'a pas été fournie (vérifie les autorisations de ton navigateur).'
        useToastStore.getState().addToast({
          type: 'plant_flag',
          message: `Lieu créé à distance. ${distNote} Pour devenir veilleur, déplace-toi sur place et plante ton étendard depuis la fiche du lieu.`,
          timestamp: Date.now(),
        })
      }

      // 3. Si plusieurs tags, insérer les tags secondaires
      if (selectedTagIds.length > 1) {
        const secondaryTags = selectedTagIds.slice(1).map(tagId => ({
          place_id: placeId,
          tag_id: tagId,
          is_primary: false,
        }))
        const { error: tagErr } = await supabase.from('place_tags').insert(secondaryTags)
        if (tagErr) console.error('[AddPlaceFlow] insert secondary tags failed', tagErr)
      }

      // 4. Optimistic updates
      setNewPlaceId(placeId)
      usePlayerStore.getState().addDiscoveredId(placeId)
      useMapStore.getState().incrementPlacesRefreshKey()

      // 5. Toast — message complet avec gains réels (lieu + visite + plantage
      // si sur place GPS). On a l'info isGps ici, contrairement au toast
      // realtime qui le perd. Le handler usePlayer.ts skip new_place isSelf
      // pour éviter doublon.
      const ruleSet = useGloryRulesStore.getState().rules
      const totalGlory = (ruleSet['glory.add_place'] ?? 7)
        + (data.isGps ? (ruleSet['glory.visit_gps'] ?? 3) + (ruleSet['glory.plant_flag'] ?? 2) : 0)
      const totalCoupe = (ruleSet['coupe.add_place'] ?? 7)
        + (data.isGps ? (ruleSet['coupe.visit_gps'] ?? 3) + (ruleSet['coupe.plant_flag'] ?? 2) : 0)
      const gainParts: string[] = []
      if (totalGlory > 0) gainParts.push(`+${totalGlory} Gloire`)
      if (totalCoupe > 0) gainParts.push(`+${totalCoupe} Coupe`)
      useToastStore.getState().addToast({
        type: 'new_place',
        message: `📜 Tu as cartographié ${title.trim()} ${gainParts.join(' / ')}`,
        timestamp: Date.now(),
        placeId,
        placeLocation: { latitude: confirmedCoords.lat, longitude: confirmedCoords.lng },
      })

      // Refresh défis — actions add + veilleur (si GPS) font avancer les défis
      useDefisStore.getState().refresh(userId)
      setStep('success')
    } catch (err) {
      // Les photos sont déjà lues/compressées à la sélection : ici on ne peut
      // plus tomber sur "Failed to read file", seulement upload/RPC/réseau.
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setStep('form')
    }
  }

  function handleViewPlace() {
    if (!newPlaceId || !confirmedCoords) return
    useMapStore.getState().requestFlyTo({ lng: confirmedCoords.lng, lat: confirmedCoords.lat, placeId: newPlaceId })
    handleClose()
  }

  function handleAddAnother() {
    setTitle('')
    photos.forEach(p => URL.revokeObjectURL(p.preview))
    setPhotos([])
    setSelectedTagIds([])
    setAddress('')
    setDescription('')
    setError(null)
    setNewPlaceId(null)
    setConfirmedCoords(null)
    setCharterChecks([false, false, false])
    setEraId(null)
    setYearExact(null)
    // Repart sur un ajout normal : on purge tout résidu du mode publication.
    setPublishingDraft(null)
    draftPrefillDoneRef.current = false
    setDraftImages([])
    setNearby([])
    setMergeChoice(null)
    setStep('location')
  }

  const allCharterChecked = charterChecks.every(Boolean)
  // En mode publication, une collision non tranchée bloque le submit (choix conscient).
  const collisionPending = publishingDraft !== null && nearby.length > 0 && mergeChoice === null
  const canSubmit = title.trim().length > 0 && (photos.length + draftImages.length) > 0 && !preparingPhotos && selectedTagIds.length > 0 && description.trim().length > 0 && allCharterChecked && eraId !== null && !collisionPending

  // ===== STEP 1 : Location =====
  if (step === 'location') {
    return (
      <MapCrosshairPicker
        title="Placer un lieu"
        confirmLabel="Placer ici"
        onConfirm={handleConfirmLocation}
        onCancel={handleClose}
      />
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

          <EraSelector
            eraId={eraId}
            yearExact={yearExact}
            onChange={(era, year) => { setEraId(era); setYearExact(year) }}
            required
          />

          {/* Coordonnées confirmées */}
          {confirmedCoords && (
            <div className="add-place-coords-display">
              {confirmedCoords.lat.toFixed(7)}, {confirmedCoords.lng.toFixed(7)}
            </div>
          )}

          {/* Adresse (optionnel) */}
          <label className="add-place-label">Adresse <span className="add-place-optional">(optionnel)</span></label>
          <input
            className="add-place-input"
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Ex: 12 rue du Chateau, 06000 Nice"
          />

          {/* Description initiale du lieu */}
          <div className="add-place-carnet-frame">
            <div className="add-place-carnet-header">
              <span className="add-place-carnet-icon">📖</span>
              <div>
                <p className="add-place-carnet-title">La description du lieu</p>
                <p className="add-place-carnet-subtitle">Vous posez la première pierre. Les autres aventuriers pourront l'enrichir.</p>
              </div>
            </div>

            {/* Photos */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />
            {(photos.length + draftImages.length) > 0 ? (
              <div className="add-place-photos-grid">
                {draftImages.map((img) => (
                  <div key={img.id} className="add-place-photo-thumb">
                    <img src={img.thumb} alt="Photo de la marque" draggable={false} />
                    <button
                      className="add-place-photo-remove"
                      onClick={() => setDraftImages(prev => prev.filter(x => x.id !== img.id))}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {photos.map((photo, i) => (
                  <div
                    key={photo.preview}
                    className={`add-place-photo-thumb${dragIndex === i ? ' dragging' : ''}${dragOverIndex === i ? ' drag-over' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={e => handleDragOver(e, i)}
                    onDrop={() => handleDrop(i)}
                    onDragEnd={handleDragEnd}
                  >
                    <img src={photo.preview} alt={`Photo ${i + 1}`} draggable={false} />
                    {i === 0 && draftImages.length === 0 && <span className="add-place-photo-main">Principale</span>}
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
                  disabled={preparingPhotos}
                >
                  {preparingPhotos ? '…' : '+'}
                </button>
              </div>
            ) : (
              <button
                className="add-place-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={preparingPhotos}
              >
                {preparingPhotos ? '⏳ Préparation des photos…' : '📷 Ajouter des photos'}
              </button>
            )}

            {/* Texte de la description */}
            <textarea
              className="add-place-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décrivez ce lieu : son histoire, son intérêt, comment y accéder, votre ressenti…"
              rows={4}
            />
          </div>
          {/* Charte du lieu */}
          <div className="add-place-charter">
            <div className="add-place-charter-header">
              <span className="add-place-charter-icon">🏰</span>
              <p className="add-place-charter-title">Charte de l'explorateur érudit</p>
            </div>
            <p className="add-place-charter-intro">
              Runes de Chêne s'oppose à l'Oubli. Chaque lieu ajouté sur la Carte doit favoriser le réenchantement de notre époque. <b>L'objectif</b> est 
              de créer la plus grande carte de lieux atypiques, anciens, naturels pour s'opposer à la froideur
              du monde moderne.
            </p>
            <div className="add-place-charter-divider" />
            {[
              'Ce lieu a une valeur historique, naturelle, patrimoniale ou atypique.',
              'Ma description raconte l\'histoire ou l\'intérêt de ce lieu, laissant un avis fiable pour vos compagnons de route',
              'Mes photos montrent le lieu tel qu\'il est — pas de selfies, pas de filtres, pas de photos trouvées en ligne',
            ].map((text, i) => (
              <label key={i} className="add-place-charter-check">
                <input
                  type="checkbox"
                  checked={charterChecks[i]}
                  onChange={() => setCharterChecks(prev => prev.map((v, j) => j === i ? !v : v))}
                />
                <span>{text}</span>
              </label>
            ))}
          </div>

          {/* Collision : lieux existants proches de la marque */}
          {publishingDraft && nearby.length > 0 && (
            <div
              style={{
                background: 'var(--parchment-bg, #f4ecd8)',
                border: '1px solid var(--parchment-border, #c9b890)',
                borderRadius: 8,
                padding: '12px 14px',
                margin: '12px 0',
              }}
            >
              <p style={{ margin: '0 0 10px', fontWeight: 600 }}>
                Ce lieu existe peut-être déjà — est-ce l'un de ceux-ci ?
              </p>
              {nearby.map(c => {
                const selected = mergeChoice === c.placeId
                return (
                  <button
                    key={c.placeId}
                    type="button"
                    onClick={() => setMergeChoice(c.placeId)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      gap: 8,
                      padding: '8px 10px',
                      marginBottom: 6,
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: selected
                        ? '2px solid var(--parchment-accent, #7a5c2e)'
                        : '1px solid var(--parchment-border, #c9b890)',
                      background: selected ? 'var(--parchment-accent-bg, #e8dcc0)' : 'transparent',
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    <span>{c.title}</span>
                    <span style={{ opacity: 0.7, whiteSpace: 'nowrap' }}>{Math.round(c.distanceM)} m</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setMergeChoice('new')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: mergeChoice === 'new'
                    ? '2px solid var(--parchment-accent, #7a5c2e)'
                    : '1px solid var(--parchment-border, #c9b890)',
                  background: mergeChoice === 'new' ? 'var(--parchment-accent-bg, #e8dcc0)' : 'transparent',
                  fontWeight: mergeChoice === 'new' ? 600 : 400,
                }}
              >
                Non, créer un nouveau lieu
              </button>
            </div>
          )}

          {/* Rewards preview */}
          {confirmedCoords && (() => {
            const distanceKm = userPosition
              ? haversineKm(userPosition.lat, userPosition.lng, confirmedCoords.lat, confirmedCoords.lng)
              : null
            const isOnSite = distanceKm !== null && distanceKm < 0.5
            // V0.7.6 (8/05) — zone "tu pensais être sur place mais le pin tombe à côté".
            // Si l'utilisateur a une position GPS valide et que le pin est entre 200m
            // et 50km de lui, on suggère explicitement de recentrer (vrai cas le plus
            // fréquent du bug "création créée sans plant_flag automatique").
            const isMisplaced = distanceKm !== null && distanceKm >= 0.2 && distanceKm < 50
            const recenterOnUser = () => {
              if (!userPosition) return
              setConfirmedCoords({ lat: userPosition.lat, lng: userPosition.lng })
              useMapStore.getState().requestFlyTo({ lng: userPosition.lng, lat: userPosition.lat })
            }
            // V0.7.13 (11/05) — barème dynamique lu depuis app_settings (gloryRulesStore),
            // plus de "+15 exploration" hardcodé. Cohérent avec le bloc Success.
            const r = useGloryRulesStore.getState().rules
            const gAdd = Number(r['glory.add_place'] ?? 0)
            const gGps = Number(r['glory.visit_gps'] ?? 0)
            const gPlant = Number(r['glory.plant_flag'] ?? 0)
            const cAdd = Number(r['coupe.add_place'] ?? 0)
            const cGps = Number(r['coupe.visit_gps'] ?? 0)
            const cPlant = Number(r['coupe.plant_flag'] ?? 0)
            const fmtGain = (g: number, c: number) => {
              const parts: string[] = []
              if (g > 0) parts.push(`+${g} 🎖️ Gloire`)
              if (c > 0) parts.push(`+${c} 🏆 Coupe des Factions`)
              return parts.join(' · ')
            }
            return (
              <div className="add-place-rewards">
                <p className="add-place-rewards-title">{isOnSite ? '🎯 Vous êtes sur place !' : '📍 Ajout à distance'}</p>
                <div className="add-place-rewards-list">
                  {isOnSite && <span className="add-place-reward add-place-reward-bonus">🏴 Vous devenez veilleur du lieu</span>}
                  <span className="add-place-reward">
                    <span className="add-place-reward-pill">Lieu ajouté</span>
                    <span className="add-place-reward-gain">{fmtGain(gAdd, cAdd)}</span>
                  </span>
                  {isOnSite && (
                    <span className="add-place-reward">
                      <span className="add-place-reward-pill add-place-reward-pill-gps">Visite sur place</span>
                      <span className="add-place-reward-gain">{fmtGain(gGps, cGps)}</span>
                    </span>
                  )}
                  {isOnSite && (gPlant > 0 || cPlant > 0) && (
                    <span className="add-place-reward">
                      <span className="add-place-reward-pill add-place-reward-pill-gps">Étendard planté</span>
                      <span className="add-place-reward-gain">{fmtGain(gPlant, cPlant)}</span>
                    </span>
                  )}
                  {!isOnSite && <span className="add-place-reward add-place-reward-hint">💡 Rendez-vous sur place pour devenir veilleur du lieu !</span>}
                </div>
                {!isOnSite && isMisplaced && userPosition && (
                  <div className="add-place-misplaced-warning">
                    <p className="add-place-misplaced-text">
                      ⚠️ Tu sembles à <strong>
                        {distanceKm! < 1
                          ? `${Math.round(distanceKm! * 1000)} m`
                          : `${distanceKm!.toFixed(1)} km`}
                      </strong> du point posé.
                      {' '}Si tu es en réalité sur place, recentre le pin pour devenir veilleur automatiquement.
                    </p>
                    <button
                      type="button"
                      className="add-place-misplaced-cta"
                      onClick={recenterOnUser}
                    >
                      📍 Recentrer sur ma position
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
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
        <div className="add-place-success-icon">✨</div>
        <h2 className="add-place-success-title">Lieu ajouté !</h2>
        <p className="add-place-success-text">
          Votre lieu apparaît maintenant sur la carte.
        </p>

        {rewards && (() => {
          const r = useGloryRulesStore.getState().rules
          const fmt = (g: number, c: number) => {
            const parts: string[] = []
            if (g > 0) parts.push(`+${g} Gloire`)
            if (c > 0) parts.push(`+${c} Coupe`)
            return parts.join(' / ')
          }
          return (
            <div className="add-place-rewards-summary">
              <p className="add-place-rewards-summary-title">Vos récompenses</p>
              {/* V067 — toutes les valeurs lues depuis le barème centralisé
                  (app_settings via gloryRulesStore). Modification dans le Hub
                  → reflétée ici au prochain boot, sans déploy. */}
              <div className="add-place-reward-line">
                <span>🏛️</span>
                <span>{fmt(r['glory.add_place'], r['coupe.add_place'])} <span className="add-place-reward-tag">lieu ajouté</span></span>
              </div>
              {rewards.isGps && (
                <div className="add-place-reward-line">
                  <span>🥾</span>
                  <span>{fmt(r['glory.visit_gps'], r['coupe.visit_gps'])} <span className="add-place-reward-tag gps">visite sur place</span></span>
                </div>
              )}
              {rewards.contentPoints > 0 && (
                <div className="add-place-reward-line">
                  <span>📜</span>
                  <span>{fmt(r['glory.carnet'], r['coupe.carnet'])} <span className="add-place-reward-tag">carnet</span></span>
                </div>
              )}
              {rewards.isGps && (
                <>
                  <div className="add-place-reward-line">
                    <span>🏴</span>
                    <span>{fmt(r['glory.plant_flag'], r['coupe.plant_flag'])} <span className="add-place-reward-tag gps">étendard planté</span></span>
                  </div>
                  <p className="add-place-success-text" style={{ marginTop: 12, fontStyle: 'italic' }}>
                    Votre étendard est planté. Vous êtes désormais protecteur de ce lieu.
                  </p>
                </>
              )}
            </div>
          )
        })()}

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
