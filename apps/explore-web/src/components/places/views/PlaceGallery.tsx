import './PlaceGallery.css'

interface GalleryPhoto {
  url: string
  carnetId: number
}

interface PlaceGalleryProps {
  photos: GalleryPhoto[]
  onPhotoOpen?: (photos: string[], index: number) => void
}

export function PlaceGallery({ photos, onPhotoOpen }: PlaceGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="gallery-empty">
        Aucune photo pour l'instant.
      </div>
    )
  }

  const allUrls = photos.map(p => p.url)

  return (
    <div className="gallery-grid">
      {photos.map((photo, i) => (
        <button
          key={`${photo.carnetId}-${i}`}
          className="gallery-item"
          onClick={() => onPhotoOpen?.(allUrls, i)}
        >
          <img src={photo.url} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  )
}
