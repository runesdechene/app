import './PlaceGallery.css'

interface GalleryPhoto {
  url: string
  carnetId: number
}

interface PlaceGalleryProps {
  photos: GalleryPhoto[]
  onPhotoClick: (carnetId: number) => void
}

export function PlaceGallery({ photos, onPhotoClick }: PlaceGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="gallery-empty">
        Aucune photo pour l'instant. Ajoutez des photos à votre carnet !
      </div>
    )
  }

  return (
    <div className="gallery-grid">
      {photos.map((photo, i) => (
        <button
          key={`${photo.carnetId}-${i}`}
          className="gallery-item"
          onClick={() => onPhotoClick(photo.carnetId)}
        >
          <img src={photo.url} alt="" loading="lazy" />
        </button>
      ))}
    </div>
  )
}
