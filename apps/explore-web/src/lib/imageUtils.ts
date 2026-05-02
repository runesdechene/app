const IMAGE_QUALITY = 0.82

/** Redimensionne et convertit une image en WebP avant upload.
 *  Utilise FileReader (pas URL.createObjectURL) : sur iOS / mobile, l'input
 *  camera renvoie parfois un File "lazy-loaded" dont le contenu n'est pas
 *  encore matérialisé au moment du createObjectURL → l'image fail à charger
 *  ("Failed to load image"). FileReader force la lecture complète du blob
 *  avant tout, fiable sur tous les devices. */
export function compressImage(file: File, maxDimension = 1920): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Failed to read file'))

    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()

      img.onerror = () => reject(new Error('Failed to load image'))

      img.onload = () => {
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round(height * (maxDimension / width))
            width = maxDimension
          } else {
            width = Math.round(width * (maxDimension / height))
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context unavailable'))

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compression failed'))
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
              type: 'image/webp',
            })
            resolve(compressed)
          },
          'image/webp',
          IMAGE_QUALITY,
        )
      }

      img.src = dataUrl
    }

    reader.readAsDataURL(file)
  })
}
