import parcheminImg from '../../assets/parchemin.png'
import './DailyEnigma.css'

export interface EnigmaMenuFragment {
  fragmentId: number
  name: string
  icon: string | null
  iconUrl: string | null
  imageUrl: string | null
  hasEnigma: boolean
  enigmaCooldown: boolean
  enigmaNextAt: string | null
}

interface Props {
  dailyDone: boolean
  /** Countdown jusqu'à la prochaine énigme du jour (ex: "5h12"). */
  dailyCountdown: string
  fragments: EnigmaMenuFragment[]
  onSelectDaily: () => void
  onSelectFragment: (fragment: { fragmentId: number; name: string; icon: string | null; iconUrl: string | null }) => void
  onClose: () => void
}

function getTimeUntil(isoDate: string | null): string {
  if (!isoDate) return ''
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return 'Disponible'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h${m.toString().padStart(2, '0')}`
}

/**
 * Menu de sélection d'énigme : énigme du jour + fragments avec énigme dispo.
 * Source unique partagée entre EnigmaChestButton (carte desktop) et
 * DailyEnigmaCard (home mobile).
 */
export function EnigmaMenu({ dailyDone, dailyCountdown, fragments, onSelectDaily, onSelectFragment, onClose }: Props) {
  const visibleFragments = fragments.filter((f) => f.hasEnigma || f.enigmaCooldown)

  return (
    <div className="enigma-menu-overlay" onClick={onClose}>
      <div className="enigma-menu" onClick={(e) => e.stopPropagation()}>
        <p className="enigma-menu-title">Choisissez une énigme</p>

        <button
          className={`enigma-menu-item${dailyDone ? ' enigma-menu-item-disabled' : ''}`}
          onClick={dailyDone ? undefined : onSelectDaily}
          disabled={dailyDone}
        >
          <img src={parcheminImg} alt="" className="enigma-menu-item-img" />
          <div className="enigma-menu-item-info">
            <span className="enigma-menu-item-name">Énigmes du jour</span>
            <span className="enigma-menu-item-sub">
              {dailyDone ? `Revient dans ${dailyCountdown}` : 'Gratuite'}
            </span>
          </div>
          {!dailyDone && <span className="enigma-menu-item-badge">{'⭐'}</span>}
          {dailyDone && <span className="enigma-menu-item-badge" style={{ opacity: 0.4 }}>{'✔'}</span>}
        </button>

        {visibleFragments.map((f) => {
          const done = f.enigmaCooldown
          return (
            <button
              key={f.fragmentId}
              className={`enigma-menu-item${done ? ' enigma-menu-item-disabled' : ''}`}
              onClick={done ? undefined : () => onSelectFragment({ fragmentId: f.fragmentId, name: f.name, icon: f.icon, iconUrl: f.iconUrl })}
              disabled={done}
            >
              {f.imageUrl ? (
                <img src={f.imageUrl} alt="" className="enigma-menu-item-img" />
              ) : f.icon ? (
                <span className="enigma-menu-item-img" style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</span>
              ) : (
                <span className="enigma-menu-item-img" style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'🏛️'}</span>
              )}
              <div className="enigma-menu-item-info">
                <span className="enigma-menu-item-name">{f.name}</span>
                <span className="enigma-menu-item-sub">
                  {done ? `Revient dans ${getTimeUntil(f.enigmaNextAt)}` : 'Disponible'}
                </span>
              </div>
              {!done && <span className="enigma-menu-item-badge">{'⭐'}</span>}
              {done && <span className="enigma-menu-item-badge" style={{ opacity: 0.4 }}>{'✔'}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
