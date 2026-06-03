import { useMemo, useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { CommentCard } from './CommentCard'
import { CommentComposer } from './CommentComposer'
import type { V05Contribution } from '../../../types/placeDetail'

interface Props {
  placeId: string
  comments: V05Contribution[]   // type === 'comment'
  onPhotoOpen: (photos: string[], index: number) => void
  onChanged: () => void
}

export function DiscussionThread({ placeId, comments, onPhotoOpen, onChanged }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [replyTo, setReplyTo] = useState<number | null>(null)

  const roots = useMemo(() => comments.filter(c => c.parentId === null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [comments])
  const repliesByParent = useMemo(() => {
    const m = new Map<number, V05Contribution[]>()
    comments.filter(c => c.parentId !== null).forEach(c => {
      const arr = m.get(c.parentId!) ?? []; arr.push(c); m.set(c.parentId!, arr)
    })
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return m
  }, [comments])

  return (
    <div className="discussion-thread">
      {userId && replyTo === null && (
        <CommentComposer placeId={placeId} onPosted={onChanged} />
      )}
      {roots.length === 0 && <p className="place-tab-empty">Personne n'a encore écrit ici. Lance la discussion !</p>}
      {roots.map(c => (
        <div key={c.id}>
          <CommentCard
            comment={c}
            replies={repliesByParent.get(c.id) ?? []}
            onPhotoOpen={onPhotoOpen}
            onReply={(pid) => setReplyTo(prev => prev === pid ? null : pid)}
            onChanged={onChanged}
          />
          {userId && replyTo === c.id && (
            <div style={{ marginLeft: 22 }}>
              <CommentComposer placeId={placeId} parentId={c.id} onPosted={() => { setReplyTo(null); onChanged() }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
