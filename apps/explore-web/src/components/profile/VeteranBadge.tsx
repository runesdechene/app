import './VeteranBadge.css'

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

export function VeteranBadge({ size = 'md' }: Props) {
  return (
    <div
      className={`veteran-badge veteran-badge--${size}`}
      title="Vétéran de la Première Époque"
      aria-label="Vétéran de la Première Époque"
    >
      <span className="veteran-badge__icon">⚜</span>
      <span className="veteran-badge__lbl">Vétéran</span>
    </div>
  )
}
