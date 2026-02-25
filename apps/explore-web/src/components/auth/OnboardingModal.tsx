import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { compressImage } from '../../lib/imageUtils'
import { useFogStore } from '../../stores/fogStore'

interface OnboardingModalProps {
  onComplete: () => void
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [instagram, setInstagram] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const userId = useFogStore(s => s.userId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setAvatarPreview(url)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !userId) return
    setLoading(true)
    setError(null)

    let avatarUrl: string | undefined

    // Upload avatar si choisi
    if (avatarFile) {
      const compressed = await compressImage(avatarFile, 400)
      const path = `avatars/${userId}.webp`
      const { error: uploadErr } = await supabase.storage
        .from('place-images')
        .upload(path, compressed, { contentType: 'image/webp', upsert: true })

      if (uploadErr) {
        setError('Erreur lors de l\'upload de l\'avatar')
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('place-images').getPublicUrl(path)
      avatarUrl = urlData.publicUrl
    }

    // Sauvegarder le profil
    const { data, error: rpcErr } = await supabase.rpc('update_my_profile', {
      p_user_id: userId,
      p_first_name: name.trim(),
      p_bio: bio.trim() || null,
      p_instagram: instagram.trim() || null,
      p_avatar_url: avatarUrl ?? null,
    })

    if (rpcErr || (data as { success?: boolean })?.success === false) {
      setError('Erreur lors de la sauvegarde')
      setLoading(false)
      return
    }

    // Mettre a jour le store
    useFogStore.getState().setUserName(name.trim())
    if (avatarUrl) {
      useFogStore.getState().setUserAvatarUrl(avatarUrl)
    }

    setLoading(false)
    onComplete()
  }

  const initial = name.trim() ? name.trim()[0].toUpperCase() : '?'

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <h2 className="onboarding-title">Creez votre Aventurier</h2>
        <p className="onboarding-subtitle">
          Personnalisez votre profil avant de rejoindre une Faction
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {/* Avatar */}
          <div className="onboarding-avatar-section">
            <button
              type="button"
              className="onboarding-avatar-btn"
              onClick={() => fileRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="onboarding-avatar-img" />
              ) : (
                <span className="onboarding-avatar-initial">{initial}</span>
              )}
              <span className="onboarding-avatar-edit">Choisir une photo</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              hidden
            />
          </div>

          {/* Nom */}
          <label className="onboarding-label">
            Nom d'aventurier *
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 50))}
              placeholder="Votre nom d'explorateur"
              required
              className="onboarding-input"
              autoFocus
              maxLength={50}
            />
          </label>

          {/* Bio */}
          <label className="onboarding-label">
            Bio
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 280))}
              placeholder="Quelques mots sur vous... (optionnel)"
              className="onboarding-textarea"
              maxLength={280}
              rows={3}
            />
          </label>

          {/* Instagram */}
          <label className="onboarding-label">
            Instagram
            <input
              type="text"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              placeholder="@votre_compte (optionnel)"
              className="onboarding-input"
            />
          </label>

          {error && <p className="onboarding-error">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="onboarding-submit"
          >
            {loading ? 'Enregistrement...' : 'Commencer l\'aventure'}
          </button>
        </form>
      </div>
    </div>
  )
}
