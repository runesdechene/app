import './PhotoSlideshow.css'

interface PhotoSlideshowProps {
  photos: string[]
  /** Index de la photo actuellement affichée dans le hero (surlignée). */
  activeIndex: number
  /** Clic sur une vignette → affiche cette photo dans le hero au-dessus. */
  onSelect: (index: number) => void
  onAddPhoto: () => void
  /** « Présence ou veille » : seuls ajouteur / venus sur place / veilleurs peuvent
   *  ajouter une photo. L'autorité reste la RPC ; ce booléen masque le bouton. */
  canAddPhoto: boolean
}

export function PhotoSlideshow({ photos, activeIndex, onSelect, onAddPhoto, canAddPhoto }: PhotoSlideshowProps) {
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
      {canAddPhoto && (
        <button className="photo-slideshow-add" onClick={onAddPhoto}>
          <span>+</span>Photo
        </button>
      )}
    </div>
  )
}
