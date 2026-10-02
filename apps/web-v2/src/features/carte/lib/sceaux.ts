/**
 * QUOI     — les marques des lieux, dessinées une fois dans un canevas puis confiées à MapLibre :
 *            la bille « ? » (lieu inconnu), le sceau crème (connu), le sceau d'encre (visité),
 *            l'étoile (point d'intérêt) et le fond des pilules.
 * POURQUOI — des images de carte, et non des éléments HTML : des milliers de lieux restent
 *            fluides sur un téléphone (spec Carte §3).
 * ATTENTION — une icône de type qui ne se charge ou ne se dessine pas retombe sur le losange par
 *            défaut : jamais une marque vide. Dessin en pixelRatio 2 (52 px = 26 px à l'écran).
 *            Chaque icône ne se télécharge qu'une fois : `prechargerIcones` la demande dès que les
 *            lieux arrivent, pendant que la carte prépare son fond (02/10).
 */
import type { Map as Carte } from 'maplibre-gl'
import iconeDefaut from '@/assets/ui/sceau-defaut.svg'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

const SCEAU = 52
const PETIT = 26
const RATIO = 2

// Le nom de l'image d'un lieu : l'écran le range dans les propriétés de chaque point.
export function nomImage(l: LieuCarte, couleurTypes: boolean): string {
  if (l.nature === 'curiosite') return 'curiosite'
  if (l.etat === 'inconnu') return 'bille'
  const icone = l.icone ?? 'defaut'
  if (l.etat === 'connu') return `connu-${icone}`
  return couleurTypes && l.couleur ? `visite-${icone}-${l.couleur}` : `visite-${icone}`
}

function toile(taille: number) {
  const canevas = new OffscreenCanvas(taille, taille)
  const ctx = canevas.getContext('2d')
  if (!ctx) throw new Error('canevas indisponible')
  return ctx
}

function disque(ctx: OffscreenCanvasRenderingContext2D, rayon: number) {
  const centre = ctx.canvas.width / 2
  ctx.beginPath()
  ctx.arc(centre, centre, rayon, 0, Math.PI * 2)
}

function chargerImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      resolve(image)
    }
    image.onerror = reject
    image.src = src
  })
}

const icones = new Map<string | null, Promise<HTMLImageElement>>()

function chargerIcone(src: string | null): Promise<HTMLImageElement> {
  let icone = icones.get(src)
  if (!icone) {
    icone =
      src === null
        ? chargerImage(iconeDefaut)
        : chargerImage(src).catch(() => chargerImage(iconeDefaut))
    icones.set(src, icone)
  }
  return icone
}

// Les icônes des lieux connus, demandées sans attendre la carte.
export function prechargerIcones(lieux: LieuCarte[]) {
  for (const l of lieux) {
    if (l.nature === 'lieu' && l.etat !== 'inconnu') void chargerIcone(l.icone)
  }
}

// L'icône du type, recolorée d'une seule teinte (elle sert de pochoir).
function pochoir(icone: HTMLImageElement, taille: number, teinte: string) {
  const ctx = toile(taille)
  ctx.drawImage(icone, 0, 0, taille, taille)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = teinte
  ctx.fillRect(0, 0, taille, taille)
  return ctx.canvas
}

function poserIcone(
  ctx: OffscreenCanvasRenderingContext2D,
  icone: HTMLImageElement,
  teinte: string,
) {
  const marge = 12
  const taille = SCEAU - marge * 2
  ctx.drawImage(pochoir(icone, taille, teinte), marge, marge)
}

function sceauConnu(icone: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  disque(ctx, SCEAU / 2 - 3)
  ctx.fillStyle = c.halo
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = c.encre
  ctx.stroke()
  poserIcone(ctx, icone, c.encre)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

function sceauVisite(icone: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  disque(ctx, SCEAU / 2 - 2)
  ctx.fillStyle = c.encre
  ctx.fill()
  poserIcone(ctx, icone, c.halo)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

// Mélange deux couleurs #rrggbb : `part` (0 à 1) de la première. Le canevas ne connaît pas
// `color-mix` partout, on fait le calcul ici.
export function melanger(a: string, b: string, part: number): string {
  const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const canaux = [0, 1, 2].map((i) => Math.round(canal(a, i) * part + canal(b, i) * (1 - part)))
  return `#${canaux.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// « Mes lieux en couleur » : la pastille de la V1, très appréciée (Uriel, 30/09) — un disque plein
// dans la couleur franche du type, éclairé en haut et plus profond en bas, l'icône en blanc.
function sceauCouleur(icone: HTMLImageElement, couleur: string) {
  const ctx = toile(SCEAU)
  const degrade = ctx.createLinearGradient(0, 0, 0, SCEAU)
  degrade.addColorStop(0, melanger(couleur, '#ffffff', 0.65))
  degrade.addColorStop(0.5, couleur)
  degrade.addColorStop(1, melanger(couleur, '#000000', 0.75))
  disque(ctx, SCEAU / 2 - 1)
  ctx.fillStyle = degrade
  ctx.fill()
  poserIcone(ctx, icone, '#fff')
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

// Un lieu pas encore découvert : plus petit que les sceaux, mais qu'on voit (Uriel, 28/09) —
// 17 px à l'écran, fond presque plein, cercle et « ? » d'encre francs.
const BILLE = 34

function bille(c: CouleursCarte) {
  const ctx = toile(BILLE)
  disque(ctx, BILLE / 2 - 2)
  ctx.globalAlpha = 0.95
  ctx.fillStyle = c.halo
  ctx.fill()
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 3
  ctx.strokeStyle = c.encre
  ctx.stroke()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = c.encre
  ctx.font = '700 22px Cabin, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', BILLE / 2, BILLE / 2 + 1)
  return ctx.getImageData(0, 0, BILLE, BILLE)
}

// Une étoile à quatre branches ✦, plus petite que les sceaux.
function etoile(c: CouleursCarte) {
  const ctx = toile(PETIT)
  const m = PETIT / 2
  const [grand, petit] = [PETIT / 2 - 1, 3]
  ctx.beginPath()
  ctx.moveTo(m, m - grand)
  ctx.quadraticCurveTo(m + petit, m - petit, m + grand, m)
  ctx.quadraticCurveTo(m + petit, m + petit, m, m + grand)
  ctx.quadraticCurveTo(m - petit, m + petit, m - grand, m)
  ctx.quadraticCurveTo(m - petit, m - petit, m, m - grand)
  ctx.fillStyle = c.encre
  ctx.fill()
  return ctx.getImageData(0, 0, PETIT, PETIT)
}

// Le fond d'une pilule : une gélule étirable autour du nom (`icon-text-fit`). La mienne en
// encre pleine, les autres en parchemin cerclé d'encre pâle.
function pilule(map: Carte, nom: string, fond: string, bord: string) {
  const [largeur, hauteur, rayon] = [40, 24, 12]
  const ctx = new OffscreenCanvas(largeur, hauteur).getContext('2d')
  if (!ctx) throw new Error('canevas indisponible')
  ctx.beginPath()
  ctx.roundRect(1, 1, largeur - 2, hauteur - 2, rayon - 1)
  ctx.fillStyle = fond
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = bord
  ctx.stroke()
  if (map.hasImage(nom)) return
  map.addImage(nom, ctx.getImageData(0, 0, largeur, hauteur), {
    pixelRatio: RATIO,
    stretchX: [[rayon, largeur - rayon]],
    stretchY: [[rayon - 1, rayon + 1]],
    content: [rayon, 4, largeur - rayon, hauteur - 4],
  })
}

// Les marques à dessiner : une par image, avec un lieu qui la porte (des milliers de lieux
// partagent quelques dizaines d'images) ; pas celles déjà sur la carte.
export function marquesADessiner(
  lieux: LieuCarte[],
  couleurTypes: boolean,
  dejaLa: (nom: string) => boolean,
): Map<string, LieuCarte> {
  const aDessiner = new Map<string, LieuCarte>()
  for (const l of lieux) {
    if (l.nature !== 'lieu' || l.etat === 'inconnu') continue
    const nom = nomImage(l, couleurTypes)
    if (!aDessiner.has(nom) && !dejaLa(nom)) aDessiner.set(nom, l)
  }
  return aDessiner
}

function ajouter(map: Carte, nom: string, image: ImageData) {
  if (!map.hasImage(nom)) map.addImage(nom, image, { pixelRatio: RATIO })
}

export async function ajouterMarques(
  map: Carte,
  lieux: LieuCarte[],
  c: CouleursCarte,
  couleurTypes: boolean,
): Promise<void> {
  // Le « ? » de la bille s'écrit en Cabin : la police doit être là avant de dessiner.
  await document.fonts.load('700 17px Cabin')
  ajouter(map, 'bille', bille(c))
  ajouter(map, 'curiosite', etoile(c))
  pilule(map, 'pilule', c.halo, melanger(c.encre, c.halo, 0.45))
  pilule(map, 'pilule-moi', c.encre, c.encre)

  // Chaque image une seule fois (02/10 : dessinée pour chaque lieu, elle coûtait une seconde de
  // calcul sur un PC, bien plus sur un téléphone).
  const aDessiner = marquesADessiner(lieux, couleurTypes, (nom) => map.hasImage(nom))
  await Promise.all(
    [...aDessiner].map(async ([nom, l]) => {
      const dessiner = (icone: HTMLImageElement) => {
        if (l.etat === 'connu') return sceauConnu(icone, c)
        if (couleurTypes && l.couleur) return sceauCouleur(icone, l.couleur)
        return sceauVisite(icone, c)
      }
      const icone = await chargerIcone(l.icone)
      // Une icône qui se charge mais ne se dessine pas (SVG sans taille, par exemple) prend
      // l'icône par défaut ; si même celle-là échoue, l'erreur remonte à l'écran.
      let image: ImageData
      try {
        image = dessiner(icone)
      } catch {
        image = dessiner(await chargerIcone(null))
      }
      ajouter(map, nom, image)
    }),
  )
}
