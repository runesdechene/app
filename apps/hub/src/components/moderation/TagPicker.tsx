import type { ModTag } from './types'

interface Props {
  allTags: ModTag[]
  selected: string[]           // ordre significatif : selected[0] = primary
  onChange: (ids: string[]) => void
}

// Max 3 tags. Clic ajoute (si <3) ou retire. Le 1er de la liste = principal.
export function TagPicker({ allTags, selected, onChange }: Props) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else if (selected.length < 3) {
      onChange([...selected, id])
    }
  }
  function makePrimary(id: string) {
    onChange([id, ...selected.filter(x => x !== id)])
  }
  return (
    <div className="mod-tagpick">
      {allTags.map(t => {
        const sel = selected.includes(t.id)
        const primary = selected[0] === t.id
        return (
          <span key={t.id}
                className={`mod-tagchip${sel ? ' sel' : ''}`}
                style={sel ? { background: t.background, color: t.color, borderColor: t.color } : undefined}
                onClick={() => toggle(t.id)}
                onDoubleClick={() => sel && makePrimary(t.id)}
                title={sel ? 'Double-clic = définir comme principal' : ''}>
            {t.title}{primary ? ' ★' : ''}
          </span>
        )
      })}
    </div>
  )
}
