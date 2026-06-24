import { useState } from 'react'
import { useCompanyStore } from '../../stores/companyStore'

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}min`
  return `${m}min`
}

interface Props {
  userId: string
  companyId: string
  isActive: boolean
  accentColor: string
}

export function CompanyBannerToggle({ userId, companyId, isActive, accentColor }: Props) {
  const switchBanner = useCompanyStore((s) => s.switchBanner)
  const [loading, setLoading] = useState(false)
  // Secondes de cooldown restantes (renseignées après une erreur cooldown)
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0)

  async function handleToggle() {
    if (loading || cooldownSeconds > 0) return
    setLoading(true)
    // Si déjà actif → retirer la bannière (null), sinon activer
    const result = await switchBanner(userId, isActive ? null : companyId)
    setLoading(false)
    if ('error' in result) {
      if (result.error === 'cooldown' && result.secondsRemaining) {
        setCooldownSeconds(result.secondsRemaining)
        // Décompte côté client
        const interval = setInterval(() => {
          setCooldownSeconds((prev) => {
            if (prev <= 1) { clearInterval(interval); return 0 }
            return prev - 1
          })
        }, 1000)
      }
    }
  }

  const disabled = loading || cooldownSeconds > 0

  return (
    <button
      style={{
        ...s.btn,
        borderColor: isActive ? accentColor : 'rgba(193,154,107,0.5)',
        background: isActive ? accentColor : 'transparent',
        color: isActive ? '#fff' : 'var(--color-ink, #4A3728)',
        opacity: disabled ? 0.55 : 1,
      }}
      onClick={handleToggle}
      disabled={disabled}
      title={cooldownSeconds > 0 ? `Disponible dans ${formatCountdown(cooldownSeconds)}` : undefined}
    >
      {loading
        ? '…'
        : isActive
          ? 'Bannière active ✓'
          : cooldownSeconds > 0
            ? `Changer dans ${formatCountdown(cooldownSeconds)}`
            : 'Porter ces couleurs'}
    </button>
  )
}

const s: Record<string, React.CSSProperties> = {
  btn: {
    padding: '10px 18px',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 500,
    fontFamily: 'var(--font-body, sans-serif)',
    transition: 'background 0.2s, color 0.2s',
    whiteSpace: 'nowrap',
  },
}
