import './LandingImage.css'

interface LandingImageProps {
  imageDesktopUrl?: string
  imageMobileUrl?: string
  framePngUrl?: string
  alt?: string
}

export default function LandingImage({
  imageDesktopUrl,
  imageMobileUrl,
  framePngUrl,
  alt = 'Personne face aux montagnes',
}: LandingImageProps) {
  if (!imageDesktopUrl && !imageMobileUrl) {
    return <div className="landing-image landing-image--placeholder" aria-hidden="true" />
  }

  return (
    <div className="landing-image">
      <picture className="landing-image__picture">
        {imageMobileUrl && (
          <source media="(max-width: 749px)" srcSet={imageMobileUrl} />
        )}
        <img
          className="landing-image__img"
          src={imageDesktopUrl || imageMobileUrl}
          alt={alt}
          loading="eager"
        />
      </picture>
      {framePngUrl && (
        <picture className="landing-image__frame" aria-hidden="true">
          <img className="landing-image__frame-img" src={framePngUrl} alt="" loading="eager" />
        </picture>
      )}
    </div>
  )
}
