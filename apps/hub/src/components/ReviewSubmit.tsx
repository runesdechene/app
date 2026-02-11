import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import './PublicForm.css'

const MAX_REVIEW_LENGTH = 2000
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

type PurchaseStatus = 'owner' | 'planning' | 'no'

const PURCHASE_OPTIONS: { value: PurchaseStatus; label: string }[] = [
  { value: 'owner', label: 'Oui, je possede du Runes de Chene' },
  { value: 'planning', label: 'Non, mais je compte en acquerir' },
  { value: 'no', label: 'Non, et je ne compte pas en acquerir' }
]

interface FormData {
  name: string
  email: string
  locationName: string
  locationZip: string
  reviewText: string
  rating: number
  purchaseStatus: PurchaseStatus
  consentAccount: boolean
  consentRepublish: boolean
}

type SubmitStep = 'form' | 'uploading' | 'success' | 'error'

export function ReviewSubmit() {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    locationName: '',
    locationZip: '',
    reviewText: '',
    rating: 0,
    purchaseStatus: 'owner',
    consentAccount: false,
    consentRepublish: false
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [step, setStep] = useState<SubmitStep>('form')
  const [progress, setProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isNewAccount, setIsNewAccount] = useState(false)
  const [hoverRating, setHoverRating] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateField = (field: keyof FormData, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_SIZE) return
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
  }

  const isValid = () => {
    return (
      form.name.trim() !== '' &&
      form.email.trim() !== '' &&
      form.email.includes('@') &&
      form.locationName.trim() !== '' &&
      form.locationZip.trim() !== '' &&
      form.reviewText.trim() !== '' &&
      form.rating >= 1 && form.rating <= 5 &&
      form.consentAccount &&
      form.consentRepublish
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid()) return

    setStep('uploading')
    setProgress('Verification du compte...')

    try {
      let userId: string

      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('email_address', form.email.toLowerCase().trim())
        .limit(1)

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id
        setIsNewAccount(false)
      } else {
        setIsNewAccount(true)
        setProgress('Creation du compte...')
        const newId = crypto.randomUUID()
        const { error: insertError } = await supabase.rpc('create_user_from_submission', {
          p_id: newId,
          p_email: form.email.toLowerCase().trim(),
          p_first_name: form.name.trim().split(' ')[0] || form.name.trim(),
          p_last_name: form.name.trim().split(' ').slice(1).join(' ') || '',
          p_instagram: null
        })

        if (insertError) throw new Error(`Erreur creation compte: ${insertError.message}`)
        userId = newId
      }

      setProgress('Enregistrement de votre avis...')

      let imageUrl: string | null = null
      let storagePath: string | null = null

      if (imageFile) {
        setProgress('Upload de la photo...')
        const ext = imageFile.name.split('.').pop() || 'jpg'
        storagePath = `reviews/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('community-photos')
          .upload(storagePath, imageFile, {
            contentType: imageFile.type,
            upsert: false
          })

        if (uploadError) throw new Error(`Erreur upload photo: ${uploadError.message}`)

        const { data: urlData } = supabase.storage
          .from('community-photos')
          .getPublicUrl(storagePath)

        imageUrl = urlData.publicUrl
      }

      const { error: reviewError } = await supabase.rpc('create_review_submission', {
        p_user_id: userId,
        p_submitter_name: form.name.trim(),
        p_submitter_email: form.email.toLowerCase().trim(),
        p_location_name: form.locationName.trim(),
        p_location_zip: form.locationZip.trim(),
        p_review_text: form.reviewText.trim(),
        p_rating: form.rating,
        p_purchase_status: form.purchaseStatus,
        p_consent_account: form.consentAccount,
        p_consent_republish: form.consentRepublish,
        p_image_url: imageUrl,
        p_storage_path: storagePath
      })

      if (reviewError) throw new Error(`Erreur soumission: ${reviewError.message}`)

      setStep('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue')
      setStep('error')
    }
  }

  const resetForm = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setForm({ name: '', email: '', locationName: '', locationZip: '', reviewText: '', rating: 0, purchaseStatus: 'owner', consentAccount: false, consentRepublish: false })
    setImageFile(null)
    setImagePreview(null)
    setStep('form')
    setErrorMsg('')
    setProgress('')
  }

  if (step === 'success') {
    return (
      <div className="submit-page">
        <div className="submit-card success-card">
          <div className="success-icon">✓</div>
          <h2>Merci pour votre avis !</h2>
          <p>Votre avis a ete envoye avec succes. Il sera examine par notre equipe avant publication.</p>
          <div className="account-info-box">
            {isNewAccount
              ? <p>Felicitations, votre adresse email <strong>{form.email}</strong> a permis la creation d'un compte <strong>Runes de Chene</strong>. Vous pouvez l'utiliser sur l'application <strong>Carte</strong> pour connecter avec la communaute.</p>
              : <p>Votre adresse email <strong>{form.email}</strong> est deja associee a un compte <strong>Runes de Chene</strong>. Votre avis a ete rattache a votre compte. Retrouvez la communaute sur l'application <strong>Carte</strong>.</p>
            }
          </div>
          <button onClick={resetForm} className="btn-primary">
            Envoyer un autre avis
          </button>
        </div>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="submit-page">
        <div className="submit-card error-card">
          <div className="error-icon">✕</div>
          <h2>Oups, une erreur est survenue</h2>
          <p>{errorMsg}</p>
          <button onClick={() => setStep('form')} className="btn-primary">
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  if (step === 'uploading') {
    return (
      <div className="submit-page">
        <div className="submit-card uploading-card">
          <div className="spinner" />
          <p>{progress}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="submit-page">
      <div className="back-button-container">
        <a href="https://runesdechene.com" className="back-button">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Retour boutique
        </a>
      </div>
      <div className="submit-header">
        <img src="/assets/cor.svg" alt="Runes de Chêne" className="header-logo" />
        <h1>Partagez votre avis</h1>
        <p>Votre retour d'experience nous aide a nous ameliorer</p>
      </div>

      <form className="submit-card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Nom *</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Votre nom"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="votre@email.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationName">Lieu *</label>
          <input
            id="locationName"
            type="text"
            value={form.locationName}
            onChange={(e) => updateField('locationName', e.target.value)}
            placeholder="Nom de la ville ou du lieu"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="locationZip">Code postal *</label>
          <input
            id="locationZip"
            type="text"
            value={form.locationZip}
            onChange={(e) => updateField('locationZip', e.target.value)}
            placeholder="75001"
            required
          />
        </div>

        <div className="form-group">
          <label>Note *</label>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                type="button"
                className={`star ${star <= (hoverRating || form.rating) ? 'active' : ''}`}
                onClick={() => updateField('rating', star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
              >
                ★
              </button>
            ))}
          </div>
          {form.rating > 0 && form.rating < 3 && (
            <div className="low-rating-notice">
              <p>Si c'est un probleme technique, respectez-vous les consignes de lavage <strong>30° maximum sans sechoir</strong> ?</p>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="reviewText">
            Votre avis * <span className="optional">(max {MAX_REVIEW_LENGTH} caracteres)</span>
          </label>
          <textarea
            id="reviewText"
            value={form.reviewText}
            onChange={(e) => {
              if (e.target.value.length <= MAX_REVIEW_LENGTH) {
                updateField('reviewText', e.target.value)
              }
            }}
            placeholder="Partagez votre experience avec Runes de Chene..."
            rows={6}
            required
          />
          <span className="char-count">
            {form.reviewText.length}/{MAX_REVIEW_LENGTH}
          </span>
        </div>

        <div className="form-group">
          <label>Avez-vous deja achete chez nous ? *</label>
          {PURCHASE_OPTIONS.map(opt => (
            <label key={opt.value} className="radio-label">
              <input
                type="radio"
                name="purchaseStatus"
                checked={form.purchaseStatus === opt.value}
                onChange={() => updateField('purchaseStatus', opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="form-group">
          <label>Photo de vous <span className="optional">(optionnel, max 5Mo)</span></label>
          <div className="photo-upload-area" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImage}
              style={{ display: 'none' }}
            />
            <div className="upload-placeholder">
              <span className="upload-icon">📷</span>
              <span>Ajouter une photo</span>
            </div>
          </div>
          {imagePreview && (
            <div className="photo-previews">
              <div className="preview-item">
                <img src={imagePreview} alt="Preview" />
                <button type="button" className="remove-photo" onClick={removeImage}>✕</button>
              </div>
            </div>
          )}
        </div>

        <div className="form-group consents">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.consentAccount}
              onChange={(e) => updateField('consentAccount', e.target.checked)}
            />
            <span>
              J'accepte la creation d'un compte Runes de Chene avec mon email, s'il n'est pas deja existant. Il m'offre l'acces gratuit a l'application Carte, et m'abonne à la newsletter. *
            </span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.consentRepublish}
              onChange={(e) => updateField('consentRepublish', e.target.checked)}
            />
            <span>
              J'accepte que mon avis soit republie par l'entreprise. *
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary btn-submit"
          disabled={!isValid()}
        >
          Envoyer mon avis
        </button>
      </form>
    </div>
  )
}
