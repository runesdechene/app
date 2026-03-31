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

/** Génère l'ImageData pour un emblème faction en forme de bouclier (pentagone pointu en bas) */
export async function buildBannerImageData(url: string, color: string): Promise<ImageData> {
  const cacheKey = `banner::${url}::${color}`
  const cached = svgImageDataCache.get(cacheKey)
  if (cached) return cached

  let rawSvg = svgTextCache.get(url)
  if (!rawSvg) {
    const res = await fetch(url)
    rawSvg = await res.text()
    svgTextCache.set(url, rawSvg)
  }

  const whiteIcon = await svgToImage(colorizeSvg(rawSvg, '#ffffff'))

  const SIZE = 150
  const SCALE = 2  // dessiner à 2x pour anti-aliasing
  const hiRes = SIZE * SCALE

  // Canvas haute résolution
  const big = document.createElement('canvas')
  big.width = hiRes
  big.height = hiRes
  const bctx = big.getContext('2d')!
  bctx.scale(SCALE, SCALE)
  const cx = SIZE / 2

  // Forme étendard : rectangle haut + pointe courte en bas
  const w = 110
  const rectH = 96
  const tipH = 40
  const x = cx - w / 2
  const y = 4

  bctx.beginPath()
  bctx.moveTo(x, y)
  bctx.lineTo(x + w, y)
  bctx.lineTo(x + w, y + rectH)
  bctx.lineTo(cx, y + rectH + tipH)
  bctx.lineTo(x, y + rectH)
  bctx.closePath()
  bctx.fillStyle = color
  bctx.fill()

  // Icône centrée dans la forme complète (rect + pointe)
  const iconSize = 80
  const iconX = cx - iconSize / 2
  const iconY = y + (rectH + tipH - iconSize) / 2 - 10
  bctx.drawImage(whiteIcon, iconX, iconY, iconSize, iconSize)

  // Downscale sur un canvas à taille finale → anti-aliasing naturel
  const small = document.createElement('canvas')
  small.width = SIZE
  small.height = SIZE
  const sctx = small.getContext('2d')!
  sctx.imageSmoothingEnabled = true
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(big, 0, 0, SIZE, SIZE)

  const imageData = sctx.getImageData(0, 0, SIZE, SIZE)
  svgImageDataCache.set(cacheKey, imageData)
  return imageData
}

/** Génère l'ImageData pour un badge fortification en forme de bannière (rectangle + demi-cercle) */
export function buildShieldImageData(level: number, color: string): ImageData {
  const cacheKey = `shield::${level}::${color}`
  const cached = svgImageDataCache.get(cacheKey)
  if (cached) return cached

  const SIZE = 64
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  // Forme bannière : rectangle + demi-cercle en bas
  const bW = 44
  const bRectH = 28
  const bR = bW / 2
  const bX = (SIZE - bW) / 2
  const bY = 4

  ctx.beginPath()
  ctx.moveTo(bX, bY)
  ctx.lineTo(bX + bW, bY)
  ctx.lineTo(bX + bW, bY + bRectH)
  ctx.arc(bX + bR, bY + bRectH, bR, 0, Math.PI)
  ctx.closePath()
  ctx.fillStyle = '#5C4033'
  ctx.fill()

  // Chiffre centré dans la forme complète (rect + demi-cercle)
  const totalH = bRectH + bR
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(level), SIZE / 2, bY + totalH / 2)

  const imageData = ctx.getImageData(0, 0, SIZE, SIZE)
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

/** Charge un emblème en forme de bannière dans la map MapLibre.
 *  `bannerKey` inclut le rate pour unicité (ex: "banner::https://...::10").
 *  La vraie URL SVG est extraite en retirant le préfixe et suffixe. */
export async function loadBannerIcon(
  map: maplibregl.Map,
  bannerKey: string,
  color: string,
): Promise<void> {
  if (map.hasImage(bannerKey)) return
  const svgUrl = bannerKey.replace(/^banner::/, '')
  const imageData = await buildBannerImageData(svgUrl, color)
  map.addImage(bannerKey, imageData, { sdf: false })
}

/** Charge un pattern SVG faction en tuile 128x128 pour fill-pattern MapLibre */
export async function loadFactionTile(
  map: maplibregl.Map,
  factionId: string,
  patternUrl: string,
  color: string,
): Promise<void> {
  const key = `tile::${factionId}`
  if (map.hasImage(key)) return

  const MOTIF_SIZE = 128
  const GAP = 50
  const TILE_SIZE = MOTIF_SIZE + GAP

  let svgText = svgTextCache.get(patternUrl)
  if (!svgText) {
    const resp = await fetch(patternUrl)
    svgText = await resp.text()
    svgTextCache.set(patternUrl, svgText)
  }

  // Coloriser avec la vraie couleur de la faction
  const colorized = colorizeSvg(svgText, color)
  const img = await svgToImage(colorized)

  const canvas = document.createElement('canvas')
  canvas.width = TILE_SIZE
  canvas.height = TILE_SIZE
  const ctx = canvas.getContext('2d')!
  // Fond transparent (le gap)
  ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
  // Dessiner le motif centré (le gap est autour)
  ctx.globalAlpha = 1
  ctx.drawImage(img, 0, 0, MOTIF_SIZE, MOTIF_SIZE)

  const imageData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE)
  map.addImage(key, imageData, { sdf: false })
}

/** Charge un badge bouclier de fortification dans la map MapLibre */
export function loadShieldIcon(
  map: maplibregl.Map,
  level: number,
  color: string = '#5C4033',
): void {
  const key = `shield::${level}`
  if (map.hasImage(key)) return
  const imageData = buildShieldImageData(level, color)
  map.addImage(key, imageData, { sdf: false })
}
