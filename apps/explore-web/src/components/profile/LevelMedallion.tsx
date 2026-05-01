import './LevelMedallion.css'

interface Props {
  level: number
  size?: 'sm' | 'md' | 'lg'
}

export function LevelMedallion({ level, size = 'md' }: Props) {
  return (
    <div className={`level-medallion level-medallion--${size}`} aria-label={`Niveau ${level}`}>
      <div className="level-medallion__inner">
        <div className="level-medallion__num">{level}</div>
        <div className="level-medallion__lbl">NIV.</div>
      </div>
    </div>
  )
}
