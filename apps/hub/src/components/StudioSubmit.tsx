import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './StudioSubmit.css'

const MAX_FILES = 10
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024
const MAX_MESSAGE = 500
const IMAGE_MAX_DIMENSION = 1920
const IMAGE_QUALITY = 0.82
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']
const NO_PRODUCT = 'none'

// Liste des départements FR (optionnel — vide pour l'étranger)
const DEPARTEMENTS = [
  '01 · Ain', '02 · Aisne', '03 · Allier', '04 · Alpes-de-Haute-Provence', '05 · Hautes-Alpes', '06 · Alpes-Maritimes',
  '07 · Ardèche', '08 · Ardennes', '09 · Ariège', '10 · Aube', '11 · Aude', '12 · Aveyron', '13 · Bouches-du-Rhône',
  '14 · Calvados', '15 · Cantal', '16 · Charente', '17 · Charente-Maritime', '18 · Cher', '19 · Corrèze', '2A · Corse-du-Sud',
  '2B · Haute-Corse', "21 · Côte-d'Or", "22 · Côtes-d'Armor", '23 · Creuse', '24 · Dordogne', '25 · Doubs', '26 · Drôme',
  '27 · Eure', '28 · Eure-et-Loir', '29 · Finistère', '30 · Gard', '31 · Haute-Garonne', '32 · Gers', '33 · Gironde',
  '34 · Hérault', '35 · Ille-et-Vilaine', '36 · Indre', '37 · Indre-et-Loire', '38 · Isère', '39 · Jura', '40 · Landes',
  '41 · Loir-et-Cher', '42 · Loire', '43 · Haute-Loire', '44 · Loire-Atlantique', '45 · Loiret', '46 · Lot', '47 · Lot-et-Garonne',
  '48 · Lozère', '49 · Maine-et-Loire', '50 · Manche', '51 · Marne', '52 · Haute-Marne', '53 · Mayenne', '54 · Meurthe-et-Moselle',
  '55 · Meuse', '56 · Morbihan', '57 · Moselle', '58 · Nièvre', '59 · Nord', '60 · Oise', '61 · Orne', '62 · Pas-de-Calais',
  '63 · Puy-de-Dôme', '64 · Pyrénées-Atlantiques', '65 · Hautes-Pyrénées', '66 · Pyrénées-Orientales', '67 · Bas-Rhin',
  '68 · Haut-Rhin', '69 · Rhône', '70 · Haute-Saône', '71 · Saône-et-Loire', '72 · Sarthe', '73 · Savoie', '74 · Haute-Savoie',
  '75 · Paris', '76 · Seine-Maritime', '77 · Seine-et-Marne', '78 · Yvelines', '79 · Deux-Sèvres', '80 · Somme', '81 · Tarn',
  '82 · Tarn-et-Garonne', '83 · Var', '84 · Vaucluse', '85 · Vendée', '86 · Vienne', '87 · Haute-Vienne', '88 · Vosges',
  '89 · Yonne', '90 · Territoire de Belfort', '91 · Essonne', '92 · Hauts-de-Seine', '93 · Seine-Saint-Denis', '94 · Val-de-Marne',
  "95 · Val-d'Oise", '971 · Guadeloupe', '972 · Martinique', '973 · Guyane', '974 · La Réunion', '976 · Mayotte',
]

const isVideo = (f: File) => f.type.startsWith('video/')
const isImage = (f: File) => f.type.startsWith('image/')
const maxSizeFor = (f: File) => (isVideo(f) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE)

/** Redimensionne + convertit en WebP avant upload. */
function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > IMAGE_MAX_DIMENSION || height > IMAGE_MAX_DIMENSION) {
        if (width > height) { height = Math.round(height * (IMAGE_MAX_DIMENSION / width)); width = IMAGE_MAX_DIMENSION }
        else { width = Math.round(width * (IMAGE_MAX_DIMENSION / height)); height = IMAGE_MAX_DIMENSION }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas indisponible'))
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Compression échouée'))
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' }))
      }, 'image/webp', IMAGE_QUALITY)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')) }
    img.src = url
  })
}

type Phase = 'wizard' | 'uploading' | 'success' | 'error'

export function StudioSubmit() {
  const [step, setStep] = useState(1)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [sizes, setSizes] = useState<(string | null)[]>([])
  const [photoIdx, setPhotoIdx] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [ratingExperience, setRatingExperience] = useState(0)
  const [ratingProducts, setRatingProducts] = useState(0)
  const [hoverExp, setHoverExp] = useState(0)
  const [hoverProd, setHoverProd] = useState(0)
  const [teamNote, setTeamNote] = useState('')
  const [departement, setDepartement] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [consentBrand, setConsentBrand] = useState(false)
  const [consentAccount, setConsentAccount] = useState(false)
  const [phase, setPhase] = useState<Phase>('wizard')
  const [progress, setProgress] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isNewAccount, setIsNewAccount] = useState(false)
  const [welcomeCrowns, setWelcomeCrowns] = useState(0)
  const [bgUrl, setBgUrl] = useState('')
  const [asideUrl, setAsideUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mission rattachée à l'envoi. Défaut : aucune (« envoi libre »). Un envoi
  // classique ne doit JAMAIS être compté dans une mission sans choix explicite.
  // Le param `?quete=` (deep-link depuis le CTA d'une mission) ne fait que
  // pré-sélectionner — l'utilisateur voit et peut changer.
  const [activeMissions, setActiveMissions] = useState<Array<{ slug: string; title: string }>>([])
  const [selectedQuest, setSelectedQuest] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_studio_config').then(({ data }) => {
      const c = data as { bg_image_url?: string; aside_image_url?: string; welcome_crowns?: number } | null
      if (c) { setBgUrl(c.bg_image_url || ''); setAsideUrl(c.aside_image_url || ''); setWelcomeCrowns(c.welcome_crowns || 0) }
    })
    supabase.from('missions').select('slug, title').eq('status', 'published').order('starts_at', { ascending: false })
      .then(({ data }) => {
        const missions = (data as Array<{ slug: string; title: string }>) ?? []
        setActiveMissions(missions)
        const fromUrl = new URLSearchParams(window.location.search).get('quete')
        if (fromUrl && missions.some(m => m.slug === fromUrl)) setSelectedQuest(fromUrl)
      })
  }, [])

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []).filter(f => (isImage(f) || isVideo(f)) && f.size <= maxSizeFor(f))
    const merged = [...files, ...selected].slice(0, MAX_FILES)
    previews.forEach(p => URL.revokeObjectURL(p))
    setFiles(merged)
    setPreviews(merged.map(f => URL.createObjectURL(f)))
    setSizes(prev => merged.map((_, i) => prev[i] ?? null))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (i: number) => {
    URL.revokeObjectURL(previews[i])
    setFiles(prev => prev.filter((_, k) => k !== i))
    setPreviews(prev => prev.filter((_, k) => k !== i))
    setSizes(prev => prev.filter((_, k) => k !== i))
    setPhotoIdx(0)
  }

  const setSizeForCurrent = (val: string) =>
    setSizes(prev => prev.map((s, i) => i === photoIdx ? (s === val ? null : val) : s))

  const canSubmit = name.trim() !== '' && email.includes('@') && files.length > 0 && consentBrand && consentAccount

  const submit = async () => {
    if (!canSubmit) return
    setPhase('uploading')
    try {
      setProgress('Vérification du compte…')
      const { data: existing } = await supabase.from('users').select('id').eq('email_address', email.toLowerCase().trim()).limit(1)
      let userId: string
      if (existing && existing.length > 0) { userId = existing[0].id; setIsNewAccount(false) }
      else {
        setIsNewAccount(true); setProgress('Création du compte…')
        const newId = crypto.randomUUID()
        const { error } = await supabase.rpc('create_user_from_submission', {
          p_id: newId, p_email: email.toLowerCase().trim(), p_first_name: name.trim(), p_instagram: null,
        })
        if (error) throw new Error(`Compte : ${error.message}`)
        userId = newId
      }

      setProgress('Enregistrement…')
      const parsedHeightCm = (() => { const h = parseInt(heightCm, 10); return Number.isFinite(h) && h >= 100 && h <= 250 ? h : null })()
      const { data: subId, error: subErr } = await supabase.rpc('create_photo_submission', {
        p_user_id: userId, p_submitter_name: name.trim(), p_submitter_email: email.toLowerCase().trim(),
        p_submitter_instagram: null, p_message: message.trim() || null,
        p_consent_brand: consentBrand, p_consent_account: consentAccount,
        p_departement: departement || null, p_quest_ref: selectedQuest,
        p_model_height_cm: parsedHeightCm,
        p_rating_experience: ratingExperience || null,
        p_rating_products: ratingProducts || null,
        p_team_note: teamNote.trim() || null,
      })
      if (subErr) throw new Error(`Soumission : ${subErr.message}`)

      for (let i = 0; i < files.length; i++) {
        let file = files[i]
        if (isImage(file)) {
          setProgress(`Compression ${i + 1}/${files.length}…`)
          try { file = await compressImage(file) } catch { file = files[i] }
        }
        setProgress(`Envoi ${i + 1}/${files.length}…`)
        const ext = file.name.split('.').pop() || 'webp'
        const path = `submissions/${subId}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('community-photos').upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw new Error(`Upload ${i + 1} : ${upErr.message}`)
        const { data: urlData } = supabase.storage.from('community-photos').getPublicUrl(path)
        const { error: imgErr } = await supabase.rpc('add_submission_image', {
          p_submission_id: subId, p_storage_path: path, p_image_url: urlData.publicUrl, p_sort_order: i, p_size: sizes[i],
        })
        if (imgErr) throw new Error(`Fichier ${i + 1} : ${imgErr.message}`)
      }
      setPhase('success')
    } catch (err) {
      console.error('[StudioSubmit] submit failed', err)
      setErrorMsg(err instanceof Error ? err.message : 'Une erreur est survenue')
      setPhase('error')
    }
  }

  if (phase === 'uploading') {
    return <div className="studio"><div className="studio__overlay"><div className="spinner" /><p>{progress}</p></div></div>
  }
  if (phase === 'success') {
    return (
      <div className="studio" style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}>
        <div className="studio__card studio__card--center">
          <img className="success-banner" src="/assets/drapeau.svg" alt="Runes de Chêne" />
          <h2>Bienvenue dans le Mouvement !</h2>
          <p>Tes contenus partent en validation. Dès qu'ils sont adoubés, tes Couronnes de Chêne atterrissent sur ton compte — on te prévient par email.</p>
          {isNewAccount && welcomeCrowns > 0 && (
            <div className="reward-badge"><span className="reward-badge-label">Cadeau de bienvenue</span><span className="reward-badge-amount">+{welcomeCrowns} Couronnes</span></div>
          )}
          <a href="https://app.runesdechene.com" target="_blank" rel="noopener noreferrer" className="studio__cta">Ouvrir l'application →</a>
        </div>
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="studio"><div className="studio__card studio__card--center">
        <div className="error-icon">✕</div><h2>Oups</h2><p>{errorMsg}</p>
        <button className="studio__cta" onClick={() => setPhase('wizard')}>Réessayer</button>
      </div></div>
    )
  }

  const STEP_LABELS = ['Tes contenus', 'Les tailles', 'Ton histoire', 'Toi']
  const next = () => setStep(s => Math.min(4, s + 1))
  const prev = () => setStep(s => Math.max(1, s - 1))
  const sizeLabel = (s: string | null) => s == null ? '' : s === NO_PRODUCT ? 'Aucun produit' : s

  return (
    <div className="studio" style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}>
      <div className="studio__console">
        <aside className="studio__aside" style={asideUrl ? { backgroundImage: `url(${asideUrl})` } : undefined}>
          <div className="studio__aside-in">
            <div className="studio__kicker">Runes de Chêne</div>
            <h1 className="studio__title">Envoyer<br />mes contenus</h1>
            <ol className="studio__steps">
              {STEP_LABELS.map((label, i) => (
                <li key={label} className={`studio__step ${step === i + 1 ? 'now' : ''} ${step > i + 1 ? 'done' : ''}`}>
                  <span className="n">{step > i + 1 ? '✓' : i + 1}</span><span className="t">{label}</span>
                </li>
              ))}
            </ol>
            <p className="studio__quote">« On te guide pas à pas. Quelques minutes, et tes clichés rejoignent le Mouvement. »</p>
          </div>
        </aside>

        <section className="studio__panel">
          <div className="studio__mobile-header">
            <span className="studio__kicker">Runes de Chêne</span>
            <h1 className="studio__mobile-title">Envoyer mes contenus</h1>
          </div>
          <ol className="studio__steps-h" aria-hidden="true">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className={`studio__step-h ${step === i + 1 ? 'now' : ''} ${step > i + 1 ? 'done' : ''}`}>
                <span className="n">{step > i + 1 ? '✓' : i + 1}</span>
                <span className="t">{label}</span>
              </li>
            ))}
          </ol>
          {step === 1 && (
            <>
              <div className="studio__kick">Étape 1 sur 4</div>
              <h2 className="studio__h">Tes contenus</h2>
              <p className="studio__lead">Dépose tes photos et vidéos — jusqu'à {MAX_FILES}.</p>
              {activeMissions.length > 0 && (
                <div style={{ margin: '0 0 1.1rem' }}>
                  <label className="studio__label">Ces contenus répondent-ils à une mission en cours ?</label>
                  <select className="studio__field" value={selectedQuest ?? ''} onChange={(e) => setSelectedQuest(e.target.value || null)}>
                    <option value="">Envoi libre — aucune mission</option>
                    {activeMissions.map(m => <option key={m.slug} value={m.slug}>{m.title}</option>)}
                  </select>
                  <p style={{ fontSize: '.8rem', opacity: .7, margin: '.35rem 0 0', lineHeight: 1.4 }}>
                    Choisis une mission seulement si tes contenus correspondent à son thème. Sinon, laisse « Envoi libre ».
                  </p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={addFiles} style={{ display: 'none' }} />
              <div className="studio__drop" onClick={() => fileInputRef.current?.click()}>⬆ Glisse ou clique pour ajouter</div>
              {previews.length > 0 && (
                <div className="studio__thumbs">
                  {previews.map((src, i) => (
                    <div key={i} className="studio__thumb">
                      {isVideo(files[i]) ? <video src={src} muted playsInline /> : <img src={src} alt="" />}
                      <button className="studio__thumb-x" onClick={() => removeFile(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="studio__nav">
                <span />
                <button className="studio__next" disabled={files.length === 0} onClick={next}>Suivant →</button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="studio__kick">Étape 2 sur 4</div>
              <h2 className="studio__h">Quelle taille portes-tu ?</h2>
              <p className="studio__lead">Une taille par contenu — ou « aucun produit ». C'est optionnel.</p>
              {files[photoIdx] && (
                <div className="studio__stage">
                  {isVideo(files[photoIdx])
                    ? <video className="studio__shot" src={previews[photoIdx]} muted playsInline />
                    : <img className="studio__shot" src={previews[photoIdx]} alt="" />}
                  <div className="studio__sizes">
                    {SIZES.map(sz => (
                      <button key={sz} className={`studio__sz ${sizes[photoIdx] === sz ? 'on' : ''}`} onClick={() => setSizeForCurrent(sz)}>{sz}</button>
                    ))}
                    <button className={`studio__sz studio__sz--none ${sizes[photoIdx] === NO_PRODUCT ? 'on' : ''}`} onClick={() => setSizeForCurrent(NO_PRODUCT)}>Aucun produit</button>
                  </div>
                  <div className="studio__count">Contenu {photoIdx + 1} / {files.length}{sizeLabel(sizes[photoIdx]) ? ` · ${sizeLabel(sizes[photoIdx])}` : ''}</div>
                </div>
              )}
              <div className="studio__nav">
                <button className="studio__ghost" onClick={() => photoIdx > 0 ? setPhotoIdx(photoIdx - 1) : prev()}>← Précédent</button>
                <div className="studio__dots">{files.map((_, i) => <span key={i} className={`dot ${i === photoIdx ? 'on' : ''}`} />)}</div>
                <button className="studio__next" onClick={() => photoIdx < files.length - 1 ? setPhotoIdx(photoIdx + 1) : next()}>
                  {photoIdx < files.length - 1 ? 'Suivant →' : 'Continuer →'}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="studio__kick">Étape 3 sur 4</div>
              <h2 className="studio__h">Ton histoire</h2>
              <label className="studio__label">Ton avis public (marque, expérience…) (optionnel)</label>
              <textarea className="studio__field" rows={4} maxLength={MAX_MESSAGE} value={message}
                onChange={(e) => setMessage(e.target.value)} placeholder="Ce que tu veux partager publiquement sur Runes de Chêne…" />

              <label className="studio__label">Comment fut votre expérience Runes de Chêne ?</label>
              <div className="studio__stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button"
                    className={`studio__star ${star <= (hoverExp || ratingExperience) ? 'on' : ''}`}
                    onClick={() => setRatingExperience(star === ratingExperience ? 0 : star)}
                    onMouseEnter={() => setHoverExp(star)} onMouseLeave={() => setHoverExp(0)}>★</button>
                ))}
              </div>

              <label className="studio__label">Comment appréciez-vous vos produits ?</label>
              <div className="studio__stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} type="button"
                    className={`studio__star ${star <= (hoverProd || ratingProducts) ? 'on' : ''}`}
                    onClick={() => setRatingProducts(star === ratingProducts ? 0 : star)}
                    onMouseEnter={() => setHoverProd(star)} onMouseLeave={() => setHoverProd(0)}>★</button>
                ))}
              </div>

              <label className="studio__label">Un mot pour l'équipe ? <span style={{ opacity: .6 }}>(privé — ne sera jamais publié)</span></label>
              <textarea className="studio__field" rows={3} maxLength={MAX_MESSAGE} value={teamNote}
                onChange={(e) => setTeamNote(e.target.value)} placeholder="Message privé à l'équipe Runes de Chêne…" />
              <label className="studio__label">Département (optionnel)</label>
              <select className="studio__field" value={departement} onChange={(e) => setDepartement(e.target.value)}>
                <option value="">— Je préfère ne pas dire / hors France —</option>
                {DEPARTEMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="studio__nav">
                <button className="studio__ghost" onClick={prev}>← Précédent</button>
                <button className="studio__next" onClick={next}>Suivant →</button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="studio__kick">Étape 4 sur 4</div>
              <h2 className="studio__h">Toi</h2>
              <label className="studio__label">Prénom *</label>
              <input className="studio__field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" />
              <label className="studio__label">Email *</label>
              <input className="studio__field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@email.com" />
              <label className="studio__label">Ta taille (optionnel)</label>
              <input className="studio__field" type="number" inputMode="numeric" min={100} max={250} value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)} placeholder="ex. 178 (en cm)" />
              <p style={{ fontSize: '.8rem', opacity: .7, margin: '.35rem 0 .2rem', lineHeight: 1.4 }}>
                Si ta photo est retenue sur une fiche produit, ça aide les autres à choisir leur taille.
              </p>
              <label className="studio__consent"><input type="checkbox" checked={consentBrand} onChange={(e) => setConsentBrand(e.target.checked)} /> J'accepte que mes contenus soient diffusés par la marque ou ses réseaux. *</label>
              <label className="studio__consent"><input type="checkbox" checked={consentAccount} onChange={(e) => setConsentAccount(e.target.checked)} /> J'accepte la création de mon compte Runes de Chêne (accès à l'application). *</label>
              <div className="studio__nav">
                <button className="studio__ghost" onClick={prev}>← Précédent</button>
                <button className="studio__next studio__next--send" disabled={!canSubmit} onClick={submit}>Envoyer mes contenus ✦</button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
