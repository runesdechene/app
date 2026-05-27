// apps/hub/src/components/photos/ImageCurator.tsx
// Curation d'une photo : aperçu, toggles de destination (mur global / galerie produit / bloc communauté), relier produit, suppression.
import { useEffect, useState } from 'react'
import { isVideoUrl, type SubmissionImage } from './types'
import { searchShopifyProducts, type ShopifyProductHit } from '../../lib/shopifyProducts'

interface ImageCuratorProps {
  image: SubmissionImage
  onOpenLightbox: () => void
  onSetWall: (on: boolean) => Promise<void>
  onDelete: () => void
  onLink: (hit: ShopifyProductHit) => Promise<void>
  onUnlink: () => Promise<void>
  onSetPhotoProduit: (on: boolean) => Promise<void>
  onSetCommunity: (on: boolean) => Promise<void>
  onDownload: () => void
}

const sizeLabel = (s: string | null) => s == null ? '' : s === 'none' ? 'Aucun produit' : s

export function ImageCurator({ image, onOpenLightbox, onSetWall, onDelete, onLink, onUnlink, onSetPhotoProduit, onSetCommunity, onDownload }: ImageCuratorProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [hits, setHits] = useState<ShopifyProductHit[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      try { setError(null); setHits(await searchShopifyProducts(term)) }
      catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    }, 300)
    return () => clearTimeout(t)
  }, [term, open])

  const doLink = async (hit: ShopifyProductHit) => {
    setBusy(true); setError(null)
    try { await onLink(hit); setOpen(false); setTerm(''); setHits([]) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  const doUnlink = async () => {
    setBusy(true); setError(null)
    try { await onUnlink() }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }

  return (
    <div className="mod-curator">
      <div className="mod-curator__media" onClick={onOpenLightbox} style={{ cursor: 'pointer' }}>
        {isVideoUrl(image.image_url)
          ? <video src={image.image_url} muted playsInline />
          : <img src={image.image_url} alt="" />}
      </div>
      <div className="mod-curator__body">
        {sizeLabel(image.size) && <span className="mod-curator__size">{sizeLabel(image.size)}</span>}
        <label className="mod-curator__toggle">
          <input type="checkbox" checked={image.show_on_wall} disabled={busy}
            onChange={async e => { setBusy(true); setError(null); try { await onSetWall(e.target.checked) } catch (er) { setError(er instanceof Error ? er.message : String(er)) } finally { setBusy(false) } }} />
          Mur communautaire (global)
        </label>

        {image.shopify_product_id ? (
          <div className="mod-curator__linked">
            <span title={`Relié à ${image.shopify_product_title}`}>🏷 {image.shopify_product_title}</span>
            <div className="mod-curator__dest">
              <label className="mod-curator__toggle">
                <input type="checkbox" checked={image.shopify_media_id != null} disabled={busy}
                  onChange={async e => { setBusy(true); setError(null); try { await onSetPhotoProduit(e.target.checked) } catch (er) { setError(er instanceof Error ? er.message : String(er)) } finally { setBusy(false) } }} />
                Galerie du produit
              </label>
              <label className="mod-curator__toggle">
                <input type="checkbox" checked={image.show_in_community} disabled={busy}
                  onChange={async e => { setBusy(true); setError(null); try { await onSetCommunity(e.target.checked) } catch (er) { setError(er instanceof Error ? er.message : String(er)) } finally { setBusy(false) } }} />
                Bloc communauté du produit
              </label>
            </div>
            <button className="mod-curator__unlink" disabled={busy} onClick={doUnlink}>Retirer ✕</button>
          </div>
        ) : open ? (
          <div className="mod-curator__picker">
            <input autoFocus className="mod-curator__search" placeholder="Rechercher un produit…"
              value={term} onChange={e => setTerm(e.target.value)} disabled={busy} />
            {error && <div className="mod-curator__error">{error}</div>}
            <ul className="mod-curator__results">
              {hits.map(hit => (
                <li key={hit.productId}>
                  <button className="mod-hit" disabled={busy} onClick={() => doLink(hit)}>
                    {hit.imageUrl && <img className="mod-hit__img" src={hit.imageUrl} alt="" width={34} height={34} />}
                    <span className="mod-hit__title">{hit.title}</span>
                    {hit.price && <span className="mod-hit__price">{hit.price}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <button className="mod-curator__cancel" onClick={() => { setOpen(false); setTerm(''); setHits([]) }}>Annuler</button>
          </div>
        ) : (
          <button className="mod-curator__link-btn" onClick={() => { setOpen(true); setTerm(''); setHits([]); setError(null) }}>
            🔗 Relier à un produit
          </button>
        )}

        <div className="mod-curator__footer">
          <button className="mod-curator__dl" onClick={onDownload} title="Télécharger">↓</button>
          <button className="mod-curator__delete" onClick={onDelete} title="Supprimer définitivement">🗑 Supprimer</button>
        </div>
        {error && !open && <div className="mod-curator__error">{error}</div>}
      </div>
    </div>
  )
}
