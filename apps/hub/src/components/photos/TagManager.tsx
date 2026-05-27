import type { PhotoTag } from './types'

interface TagManagerProps {
  tags: PhotoTag[]
  newTagName: string
  onNewTagName: (v: string) => void
  onCreate: () => void
  onDelete: (tagId: string) => void
  onClose: () => void
}

export function TagManager({ tags, newTagName, onNewTagName, onCreate, onDelete, onClose }: TagManagerProps) {
  return (
    <div className="mod-tagmgr">
      <div className="mod-tagmgr__header">
        <h3>Tags disponibles</h3>
        <button className="mod-tagmgr__close" onClick={onClose}>Fermer</button>
      </div>
      <div className="mod-tagmgr__list">
        {tags.map(tag => (
          <div key={tag.id} className="mod-tagmgr__item">
            <span className="mod-tagmgr__pill">#{tag.name}</span>
            <button
              className="mod-tagmgr__del"
              onClick={() => onDelete(tag.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mod-tagmgr__form">
        <input
          type="text"
          placeholder="Nouveau tag..."
          value={newTagName}
          onChange={(e) => onNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        />
        <button
          onClick={onCreate}
          disabled={!newTagName.trim()}
        >
          Creer
        </button>
      </div>
    </div>
  )
}
