const IMAGE_QUALITY = 0.82

/** Lit un File en data-URL, avec retry.
 *  Sur iOS, un File issu de l'input photo est adossé à un snapshot OS
 *  éphémère : si la lecture intervient longtemps après la sélection (l'user
 *  remplit le formulaire d'ajout), le snapshot peut avoir été recyclé
 *  (pression mémoire, onglet backgroundé, photo iCloud/lourde) →
 *  `readAsDataURL` échoue avec `NotReadableError`. Cette erreur est le plus
 *  souvent transitoire : une relecture au tick suivant repasse. On retry et,
 *  en cas d'échec final, on remonte le vrai nom de l'exception (diagnostic). */
function readFileAsDataURL(file: File, attempts = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const tryRead = (remaining: number) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => {
        const name = reader.error?.name ?? 'unknown'
        if (remaining > 1) {
          // Laisse iOS re-matérialiser le blob avant de réessayer.
          setTimeout(() => tryRead(remaining - 1), 120)
          return
        }
        reject(new Error(`Failed to read file (${name})`))
      }
      reader.readAsDataURL(file)
    }
    tryRead(attempts)
  })
}

/** Redimensionne et convertit une image en WebP avant upload.
 *  Utilise FileReader (pas URL.createObjectURL) : sur iOS / mobile, l'input
 *  camera renvoie parfois un File "lazy-loaded" dont le contenu n'est pas
 *  encore matérialisé au moment du createObjectURL → l'image fail à charger
 *  ("Failed to load image"). FileReader force la lecture complète du blob
 *  avant tout, fiable sur tous les devices. */
export function compressImage(file: File, maxDimension = 1920): Promise<File> {
  return readFileAsDataURL(file).then((dataUrl) => {
    return new Promise<File>((resolve, reject) => {
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
    })
  })
}
