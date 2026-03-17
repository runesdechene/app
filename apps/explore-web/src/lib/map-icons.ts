// --- Utilitaire : SVG coloré avec bordure → ImageData pour MapLibre ---

const ICON_SIZE = 120

// Cache module-level : survit aux re-renders et changements de style
const svgImageDataCache = new Map<string, ImageData>()
const svgTextCache = new Map<string, string>()

/** Charge un SVG text en HTMLImageElement */
function svgToImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml' })
  const blobUrl = URL.createObjectURL(blob)
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject() }
    img.src = blobUrl
  })
}

/** Force une couleur de fill sur tout le SVG via <style> !important */
function colorizeSvg(rawSvg: string, color: string): string {
  const style = `<style>path,circle,rect,polygon,polyline,ellipse,line{fill:${color}!important}[fill="none"]{fill:none!important}</style>`
  return rawSvg.replace(/(<svg[^>]*>)/, `$1${style}`)
}

/** Ajuste une couleur hex : amount > 0 éclaircit, < 0 assombrit */
function shiftColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const shift = (c: number) => Math.max(0, Math.min(255, Math.round(
    amount > 0 ? c + (255 - c) * amount : c * (1 + amount),
  )))
  return `rgb(${shift(r)},${shift(g)},${shift(b)})`
}

/** Génère l'ImageData pour un SVG coloré (avec cache) */
export async function buildIconImageData(url: string, color: string): Promise<ImageData> {
  const cacheKey = `${url}::${color}`
  const cached = svgImageDataCache.get(cacheKey)
  if (cached) return cached

  // Fetch le SVG brut (avec cache texte)
  let rawSvg = svgTextCache.get(url)
  if (!rawSvg) {
    const res = await fetch(url)
    rawSvg = await res.text()
    svgTextCache.set(url, rawSvg)
  }

  const whiteIcon = await svgToImage(colorizeSvg(rawSvg, '#ffffff'))

  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')!
  const cx = ICON_SIZE / 2
  const cy = ICON_SIZE / 2
  const r = ICON_SIZE / 2 - 1

  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
  grad.addColorStop(0, shiftColor(color, 0.35))
  grad.addColorStop(0.5, color)
  grad.addColorStop(1, shiftColor(color, -0.25))

  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  const iconSize = ICON_SIZE * 0.55
  const iconOffset = (ICON_SIZE - iconSize) / 2
  ctx.drawImage(whiteIcon, iconOffset, iconOffset, iconSize, iconSize)

  const imageData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE)
  svgImageDataCache.set(cacheKey, imageData)
  return imageData
}

/** Charge une icône SVG colorée dans la map MapLibre (utilise le cache) */
export async function loadColoredSvgIcon(
  map: maplibregl.Map,
  url: string,
  color: string,
): Promise<void> {
  const imageData = await buildIconImageData(url, color)
  if (!map.hasImage(url)) {
    map.addImage(url, imageData, { sdf: false })
  }
}
