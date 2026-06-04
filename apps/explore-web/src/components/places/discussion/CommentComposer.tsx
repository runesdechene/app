import { useRef, useState, type KeyboardEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'

interface Props {
  placeId: string
  replyingTo?: { id: number; name: string } | null
  onCancelReply?: () => void
  onPosted: () => void
}

export function CommentComposer({ placeId, replyingTo = null, onCancelReply, onPosted }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function add(fl: FileList | null) {
    if (!fl) return
    const next = Array.from(fl).slice(0, 5 - files.length)
    setFiles(p => [...p, ...next]); setPreviews(p => [...p, ...next.map(f => URL.createObjectURL(f))])
  }
  function removeAt(i: number) {
    setFiles(p => p.filter((_, k) => k !== i)); setPreviews(p => p.filter((_, k) => k !== i))
  }

  async function post() {
    if (!userId || !text.trim() || busy) return
    setBusy(true)
    const urls: string[] = []
    for (const f of files) {
      const path = `places/${userId}/${crypto.randomUUID()}.webp`
      const { error } = await supabase.storage.from('place-images').upload(path, f, { contentType: 'image/webp', upsert: false })
      if (!error) urls.push(supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl)
    }
    const { data, error } = await supabase.rpc('add_place_comment', {
      p_user_id: userId, p_place_id: placeId, p_content: text.trim(), p_images: urls,
      p_parent_id: replyingTo?.id ?? null,
    })
    if (!error && (data as { success?: boolean } | null)?.success) {
      setText(''); setFiles([]); setPreviews([]); onPosted()
    }
    setBusy(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() }
  }

  return (
    <div className="composer-wrap">
      {replyingTo && (
        <div className="composer-reply-chip">
          <span>↩ Réponse à <b>{replyingTo.name}</b></span>
          <button onClick={onCancelReply} aria-label="Annuler la réponse">✕</button>
        </div>
      )}
      {previews.length > 0 && (
        <div className="composer-previews">
          {previews.map((s, i) => (
            <div key={i} className="composer-preview">
              <img src={s} alt="" />
              <button onClick={() => removeAt(i)} aria-label="Retirer">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="composer-bar">
        <button className="composer-attach" onClick={() => fileRef.current?.click()} aria-label="Ajouter une photo">📷</button>
        <input
          className="composer-field"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={replyingTo ? `Répondre à ${replyingTo.name}…` : 'Un commentaire, un conseil, une anecdote…'}
        />
        <button className="composer-send" onClick={post} disabled={busy || !text.trim()} aria-label="Publier">➤</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => add(e.target.files)} />
      </div>
    </div>
  )
}
