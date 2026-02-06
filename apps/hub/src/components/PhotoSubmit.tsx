import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const MAX_MESSAGE_LENGTH = 500
const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface FormData {
  name: string
  email: string
  instagram: string
  message: string
  consentBrand: boolean
  consentAccount: boolean
}

type SubmitStep = 'form' | 'uploading' | 'success' | 'error'

export function PhotoSubmit() {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    instagram: '',
    message: '',
    consentBrand: false,
    consentAccount: false
  })
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [step, setStep] = useState<SubmitStep>('form')
  const [progress, setProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isNewAccount, setIsNewAccount] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    const valid = selected.filter(f => {
      if (!f.type.startsWith('image/')) return false
      if (f.size > MAX_FILE_SIZE) return false
      return true
    })

    const total = [...files, ...valid].slice(0, MAX_FILES)
    setFiles(total)

    const newPreviews: string[] = []
    total.forEach(file => {
      const url = URL.createObjectURL(file)
      newPreviews.push(url)
    })
    previews.forEach(p => URL.revokeObjectURL(p))
    setPreviews(newPreviews)
  }

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index])
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const isValid = () => {
    return (
      form.name.trim() !== '' &&
      form.email.trim() !== '' &&
      form.email.includes('@') &&
      files.length > 0 &&
      form.consentBrand &&
      form.consentAccount
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid()) return

    setStep('uploading')
    setErrorMsg('')

    try {
      setProgress('Verification du compte...')
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id')
        .eq('email_address', form.email.toLowerCase().trim())
        .limit(1)

      let userId: string
      setIsNewAccount(false)

      if (existingUsers && existingUsers.length > 0) {
        userId = existingUsers[0].id
        if (form.instagram.trim()) {
          await supabase
            .from('users')
            .update({ instagram: form.instagram.trim() })
            .eq('id', userId)
        }
      } else {
        setIsNewAccount(true)
        setProgress('Creation du compte...')
        const newId = crypto.randomUUID()
        const { error: insertError } = await supabase.rpc('create_user_from_submission', {
          p_id: newId,
          p_email: form.email.toLowerCase().trim(),
          p_first_name: form.name.trim().split(' ')[0] || form.name.trim(),
          p_last_name: form.name.trim().split(' ').slice(1).join(' ') || '',
          p_instagram: form.instagram.trim() || null
        })

        if (insertError) throw new Error(`Erreur creation compte: ${insertError.message}`)
        userId = newId
      }

      setProgress('Enregistrement de la soumission...')
      const { data: submissionId, error: subError } = await supabase.rpc('create_photo_submission', {
        p_user_id: userId,
        p_submitter_name: form.name.trim(),
        p_submitter_email: form.email.toLowerCase().trim(),
        p_submitter_instagram: form.instagram.trim() || null,
        p_message: form.message.trim() || null,
        p_consent_brand: form.consentBrand,
        p_consent_account: form.consentAccount
      })

      if (subError) throw new Error(`Erreur soumission: ${subError.message}`)

      for (let i = 0; i < files.length; i++) {
        setProgress(`Upload photo ${i + 1}/${files.length}...`)
        const file = files[i]
        const ext = file.name.split('.').pop() || 'jpg'
        const storagePath = `submissions/${submissionId}/${crypto.randomUUID()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('community-photos')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false
          })

        if (uploadError) throw new Error(`Erreur upload photo ${i + 1}: ${uploadError.message}`)

        const { data: urlData } = supabase.storage
          .from('community-photos')
          .getPublicUrl(storagePath)

        const { error: imgError } = await supabase.rpc('add_submission_image', {
          p_submission_id: submissionId,
          p_storage_path: storagePath,
          p_image_url: urlData.publicUrl,
          p_sort_order: i
        })

        if (imgError) throw new Error(`Erreur enregistrement image: ${imgError.message}`)
      }

      setStep('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue')
      setStep('error')
    }
  }

  const resetForm = () => {
    previews.forEach(p => URL.revokeObjectURL(p))
    setForm({ name: '', email: '', instagram: '', message: '', consentBrand: false, consentAccount: false })
    setFiles([])
    setPreviews([])
    setStep('form')
    setErrorMsg('')
    setProgress('')
  }

  if (step === 'success') {
    return (
      <div className="submit-page">
        <div className="submit-card success-card">
          <div className="success-icon">✓</div>
          <h2>Merci pour votre contribution !</h2>
          <p>Vos photos ont ete envoyees avec succes.</p>
          <p>Elles seront examinees par notre equipe avant publication.</p>
          <p className="success-note">
            {isNewAccount
              ? <>Un compte Runes de Chene a ete cree pour <strong>{form.email}</strong>.&nbsp;</>
              : <>Votre compte Runes de Chene (<strong>{form.email}</strong>) a ete associe.&nbsp;</>
            }
            Vous recevrez un lien de connexion par email pour acceder a vos photos et a l'application Carte.
          </p>
          <button onClick={resetForm} className="btn-primary">
            Envoyer d'autres photos
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
      <div className="submit-header">
        <h1>Partagez vos photos</h1>
        <p>Runes de Chene — Communaute</p>
      </div>

      <form className="submit-form" onSubmit={handleSubmit}>
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
          <label htmlFor="instagram">Instagram <span className="optional">(optionnel)</span></label>
          <input
            id="instagram"
            type="text"
            value={form.instagram}
            onChange={(e) => updateField('instagram', e.target.value)}
            placeholder="@votre_compte"
          />
        </div>

        <div className="form-group">
          <label>Photos * <span className="optional">(max {MAX_FILES}, 10 Mo chacune)</span></label>
          
          <div className="photo-upload-area" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              style={{ display: 'none' }}
            />
            <div className="upload-placeholder">
              <span className="upload-icon">📷</span>
              <span>Cliquez pour ajouter des photos</span>
            </div>
          </div>

          {previews.length > 0 && (
            <div className="photo-previews">
              {previews.map((src, i) => (
                <div key={i} className="preview-item">
                  <img src={src} alt={`Photo ${i + 1}`} />
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={() => removeFile(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="message">
            Message <span className="optional">(optionnel, max {MAX_MESSAGE_LENGTH} caracteres)</span>
          </label>
          <textarea
            id="message"
            value={form.message}
            onChange={(e) => {
              if (e.target.value.length <= MAX_MESSAGE_LENGTH) {
                updateField('message', e.target.value)
              }
            }}
            placeholder="Racontez-nous l'histoire derriere ces photos..."
            rows={4}
          />
          <span className="char-count">
            {form.message.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>

        <div className="form-group consents">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.consentBrand}
              onChange={(e) => updateField('consentBrand', e.target.checked)}
            />
            <span>
              J'accepte que ces photos soient diffusees sur le site de la marque ou ses reseaux si l'opportunite se presente. *
            </span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.consentAccount}
              onChange={(e) => updateField('consentAccount', e.target.checked)}
            />
            <span>
              J'accepte de creer un compte Runes de Chene, me donnant acces a mes photos et l'application Carte. *
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="btn-primary btn-submit"
          disabled={!isValid()}
        >
          Envoyer mes photos
        </button>
      </form>
    </div>
  )
}
