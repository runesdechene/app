/**
 * QUOI     — une photo ou une vidéo de contribution en petit : la vignette de 400 px quand elle existe.
 * POURQUOI — une vignette absente (envoi interrompu) retombe sur la photo entière plutôt que sur un trou.
 */
import { vignetteDe } from '@/shared/lib/vignette'
import { estUneVideo } from '../lib/contribution'

export function Miniature({ url, alt = '', className }: { url: string; alt?: string; className?: string | undefined }) {
  if (estUneVideo(url)) return <video className={className} src={url} muted preload="metadata" />
  return (
    <img className={className} src={vignetteDe(url) ?? url} alt={alt} loading="lazy" decoding="async"
      onError={(e) => { if (e.currentTarget.src !== url) e.currentTarget.src = url }} />
  )
}
