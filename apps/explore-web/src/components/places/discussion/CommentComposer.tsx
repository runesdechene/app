import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'

interface Props { placeId: string; parentId?: number | null; onPosted: () => void }

export function CommentComposer({ placeId, parentId = null, onPosted }: Props) {
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
      p_user_id: userId, p_place_id: placeId, p_content: text.trim(), p_images: urls, p_parent_id: parentId,
    })
    if (!error && (data as { success?: boolean } | null)?.success) {
      setText(''); setFiles([]); setPreviews([]); onPosted()
    }
    setBusy(false)
  }

  return (
    <div className="composer">
      <button className="composer-cam" onClick={() => fileRef.current?.click()} aria-label="Ajouter une photo">📷</button>
      <input className="composer-input" value={text} onChange={e => setText(e.target.value)}
        placeholder={parentId ? 'Votre réponse…' : 'Ajoute une photo, un conseil, une anecdote…'} />
      <button className="composer-send" onClick={post} disabled={busy || !text.trim()}>Publier</button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => add(e.target.files)} />
      {previews.length > 0 && (
        <div className="composer-previews">{previews.map((s, i) => <img key={i} src={s} alt="" />)}</div>
      )}
    </div>
  )
}
