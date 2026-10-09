/**
 * QUOI     — le dessin du voile d'un lieu inconnu, sur un canevas : sa photo floutée sous un lavis
 *            de parchemin aux bords brunis (maquette 250:128) ; puis chaque coup de doigt qui le
 *            déchire, avec sa lisière claire (250:134).
 * POURQUOI — un canevas, parce qu'on efface pixel par pixel sous le doigt : aucune propriété CSS
 *            ne sait faire un trou qui grandit au fil du geste.
 * ATTENTION — le flou est celui d'une image réduite puis agrandie (le navigateur lisse) : le
 *            `filter` du canevas manque encore à Safari. Les couleurs sont les jetons de
 *            tokens.css, relus sur la page.
 */
import { couvrir, forme, type Point } from './dechirure'

type Couleurs = { lavis: string; bord: string; lisiere: string }

function couleurs(canevas: HTMLCanvasElement): Couleurs {
  const style = getComputedStyle(canevas)
  const jeton = (nom: string) => style.getPropertyValue(nom).trim()
  return {
    lavis: jeton('--color-voile'),
    bord: jeton('--color-voile-bord'),
    lisiere: jeton('--color-dechirure'),
  }
}

// La photo, floutée : réduite à quelques dizaines de pixels, puis étirée sur tout le canevas.
function photoFloutee(ctx: CanvasRenderingContext2D, photo: HTMLImageElement) {
  const { width: l, height: h } = ctx.canvas
  const partie = couvrir({ l: photo.naturalWidth, h: photo.naturalHeight }, { l, h })
  const petit = document.createElement('canvas')
  petit.width = 24
  petit.height = Math.max(1, Math.round((24 * h) / l))
  petit
    .getContext('2d')
    ?.drawImage(photo, partie.x, partie.y, partie.l, partie.h, 0, 0, petit.width, petit.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(petit, 0, 0, l, h)
}

// Sans images (pas encore chargées) : le lavis et ses bords seuls — jamais la photo nette.
export function peindreVoile(
  canevas: HTMLCanvasElement,
  photo: HTMLImageElement | null,
  parchemin: HTMLImageElement | null,
) {
  const ctx = canevas.getContext('2d')
  if (!ctx) return
  const { width: l, height: h } = canevas
  const c = couleurs(canevas)
  ctx.fillStyle = c.lavis
  ctx.fillRect(0, 0, l, h)
  if (photo) {
    photoFloutee(ctx, photo)
    // Le lavis : on devine la photo, on ne la voit pas.
    ctx.globalAlpha = 0.4
    ctx.fillRect(0, 0, l, h)
  }
  if (parchemin) {
    ctx.globalAlpha = 0.35
    const partie = couvrir({ l: parchemin.naturalWidth, h: parchemin.naturalHeight }, { l, h })
    ctx.drawImage(parchemin, partie.x, partie.y, partie.l, partie.h, 0, 0, l, h)
  }
  // Les bords brunis, comme une vieille feuille.
  ctx.globalAlpha = 0.55
  const bords = ctx.createRadialGradient(
    l / 2,
    h / 2,
    Math.min(l, h) * 0.35,
    l / 2,
    h / 2,
    Math.hypot(l, h) / 2,
  )
  bords.addColorStop(0, 'transparent')
  bords.addColorStop(1, c.bord)
  ctx.fillStyle = bords
  ctx.fillRect(0, 0, l, h)
  ctx.globalAlpha = 1
}

function tracer(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.beginPath()
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.closePath()
  ctx.fill()
}

// Un coup de doigt : d'abord la lisière claire, sur ce qui reste du voile seulement, puis le trou
// un peu plus petit. Le coup suivant perce la lisière du précédent : il n'en reste qu'au bord.
export function dechirer(canevas: HTMLCanvasElement, centre: Point, rayon: number) {
  const ctx = canevas.getContext('2d')
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = couleurs(canevas).lisiere
  tracer(ctx, forme(centre, rayon + 6, Math.random))
  ctx.globalCompositeOperation = 'destination-out'
  tracer(ctx, forme(centre, rayon, Math.random))
  ctx.globalCompositeOperation = 'source-over'
}
