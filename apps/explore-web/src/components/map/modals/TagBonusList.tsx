interface TagBonus {
  title: string
  icon: string | null
  color: string
  bg: string
}

interface Props {
  primary: TagBonus[]
  secondary: TagBonus[]
  primaryReduction?: number
  secondaryReduction?: number
}

export function TagBonusList({ primary, secondary, primaryReduction, secondaryReduction }: Props) {
  if (primary.length === 0 && secondary.length === 0) return null

  return (
    <div className="faction-card-bonuses" style={{ gap: 6 }}>
      {primary.length > 0 && (
        <>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b5a47', width: '100%' }}>Avantages primaires {primaryReduction ? <span style={{ fontWeight: 600, color: '#2a7a30' }}>(-{primaryReduction}% ⚡)</span> : null}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {primary.map(b => (
              <span key={b.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: b.bg, border: `1.5px solid ${b.color}`, fontSize: 11, fontWeight: 600, color: b.color }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: b.color, flexShrink: 0 }}>
                  {b.icon && <img src={b.icon} alt="" style={{ width: 10, height: 10, filter: 'brightness(0) invert(1)' }} />}
                </span>
                {b.title}
              </span>
            ))}
          </div>
        </>
      )}
      {secondary.length > 0 && (
        <>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#8A7B6A', width: '100%', marginTop: 4 }}>Avantages secondaires {secondaryReduction ? <span style={{ fontWeight: 600, color: '#2a7a30' }}>(-{secondaryReduction}% ⚡)</span> : null}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {secondary.map(b => (
              <span key={b.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 20, background: 'rgba(193,154,107,0.08)', border: '1px solid rgba(193,154,107,0.25)', fontSize: 10, color: '#6b5a47' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, borderRadius: '50%', background: b.color, flexShrink: 0 }}>
                  {b.icon && <img src={b.icon} alt="" style={{ width: 9, height: 9, filter: 'brightness(0) invert(1)' }} />}
                </span>
                {b.title}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
