import './PhotoSlideshow.css'

interface PhotoSlideshowProps {
  photos: string[]
  /** Index de la photo actuellement affichée dans le hero (surlignée). */
  activeIndex: number
  /** Clic sur une vignette → affiche cette photo dans le hero au-dessus. */
  onSelect: (index: number) => void
  onAddPhoto: () => void
}

export function PhotoSlideshow({ photos, activeIndex, onSelect, onAddPhoto }: PhotoSlideshowProps) {
  return (
    <div className="photo-slideshow">
      {photos.map((url, i) => (
        <button
          key={i}
          className={`photo-slideshow-thumb${i === activeIndex ? ' active' : ''}`}
          onClick={() => onSelect(i)}
        >
          <img src={url} alt="" loading="lazy" />
        </button>
      ))}
      <button className="photo-slideshow-add" onClick={onAddPhoto}>
        <span>+</span>Photo
      </button>
    </div>
  )
}
