import { useAppConfigStore } from '../../stores/appConfigStore'
import { useToastStore } from '../../stores/toastStore'
import './ShareButton.css'

interface ShareButtonProps {
  placeName: string
  placeSlug: string | null
}

export function ShareButton({ placeName, placeSlug }: ShareButtonProps) {
  const template = useAppConfigStore(s => s.shareTextTemplate)
  const addToast = useToastStore.getState().addToast

  // Pas de slug = lieu sans SEO Page → on masque le bouton
  if (!placeSlug) return null

  async function handleShare() {
    const text = template.replace('{name}', placeName)
    const url = `https://carte.runesdechene.com/lieu/${placeSlug}`
    const payload = { title: placeName, text, url }

    try {
      if (navigator.share) {
        await navigator.share(payload)
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        addToast({
          type: 'info',
          message: 'Lien copié ✓',
          timestamp: Date.now(),
        })
      } else {
        addToast({
          type: 'info',
          message: url,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      // AbortError = user a fermé le share sheet, pas une erreur
      if (err instanceof Error && err.name !== 'AbortError') {
        addToast({
          type: 'error',
          message: 'Échec du partage',
          timestamp: Date.now(),
        })
      }
    }
  }

  return (
    <button
      className="share-btn"
      onClick={handleShare}
      aria-label="Partager ce lieu"
      title="Partager"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>
  )
}
