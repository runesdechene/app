import { useMemo, useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { CommentCard } from './CommentCard'
import { CommentComposer } from './CommentComposer'
import type { V05Contribution } from '../../../types/placeDetail'
import './DiscussionThread.css'

interface Props {
  placeId: string
  comments: V05Contribution[]   // type === 'comment'
  onPhotoOpen: (photos: string[], index: number) => void
  onChanged: () => void
}

export function DiscussionThread({ placeId, comments, onPhotoOpen, onChanged }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null)

  const roots = useMemo(
    () => comments.filter(c => c.parentId === null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [comments],
  )
  const repliesByParent = useMemo(() => {
    const m = new Map<number, V05Contribution[]>()
    comments.filter(c => c.parentId !== null).forEach(c => {
      const arr = m.get(c.parentId!) ?? []; arr.push(c); m.set(c.parentId!, arr)
    })
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return m
  }, [comments])

  return (
    <div className="discussion">
      <div className="discussion-list">
        {roots.length === 0 ? (
          <p className="discussion-empty">Personne n'a encore écrit ici. Lance la discussion !</p>
        ) : (
          roots.map(c => (
            <CommentCard
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              onPhotoOpen={onPhotoOpen}
              onReply={() => setReplyTo({ id: c.id, name: c.userName })}
              onChanged={onChanged}
            />
          ))
        )}
      </div>

      {userId && (
        <CommentComposer
          placeId={placeId}
          replyingTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onPosted={() => { setReplyTo(null); onChanged() }}
        />
      )}
    </div>
  )
}
