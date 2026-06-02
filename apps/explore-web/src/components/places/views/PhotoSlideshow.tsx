import './PhotoSlideshow.css'

interface PhotoSlideshowProps {
  photos: string[]
  onOpen: (photos: string[], index: number) => void
  onAddPhoto: () => void
}

export function PhotoSlideshow({ photos, onOpen, onAddPhoto }: PhotoSlideshowProps) {
  return (
    <div className="photo-slideshow">
      {photos.map((url, i) => (
        <button key={i} className="photo-slideshow-thumb" onClick={() => onOpen(photos, i)}>
          <img src={url} alt="" loading="lazy" />
        </button>
      ))}
      <button className="photo-slideshow-add" onClick={onAddPhoto}>
        <span>+</span>Photo
      </button>
    </div>
  )
}
