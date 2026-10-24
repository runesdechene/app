/**
 * QUOI     — les marques des lieux, dessinées une fois dans un canevas puis confiées à MapLibre :
 *            le « ? » (lieu inconnu) et l'icône du type à l'encre (connu), chacun sur une lueur
 *            parchemin légère ; le sceau du type (visité, en couleur par défaut depuis le 24/10) ; le
 *            sceau d'encre (lieu neuf) ; l'étoile (point d'intérêt), le fond des pilules et la gélule
 *            « NOUVEAU ».
 * POURQUOI — des images de carte, et non des éléments HTML : des milliers de lieux restent
 *            fluides sur un téléphone (spec Carte §3). Ce qui reste à faire est un signe d'encre nu,
 *            comme sur une carte de jeu ; ce qu'on a visité prend son sceau : de loin, on voit qu'il
 *            y a plein de lieux, et la carte s'allume à mesure qu'on visite (Uriel, 24/10).
 * ATTENTION — une icône de type qui ne se charge ou ne se dessine pas retombe sur le losange par
 *            défaut : jamais une marque vide. Dessin en pixelRatio 2 (52 px = 26 px à l'écran).
 *            Chaque icône ne se télécharge qu'une fois : `prechargerIcones` la demande dès que les
 *            lieux arrivent, pendant que la carte prépare son fond (02/10).
 */
import type { Map as Carte } from 'maplibre-gl'
import iconeDefaut from '@/assets/ui/sceau-defaut.svg'
import imageInconnu from '@/assets/ui/inconnu.webp'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

const SCEAU = 52
const PETIT = 26
const RATIO = 2

// Le nom de l'image d'un lieu : l'écran le range dans les propriétés de chaque point.
export function nomImage(l: LieuCarte, couleurTypes: boolean): string {
  if (l.nature === 'curiosite') return 'curiosite'
  const icone = l.icone ?? 'defaut'
  if (l.nouveau) return l.etat === 'inconnu' ? 'neuf-inconnu' : `neuf-${icone}`
  if (l.etat === 'inconnu') return 'bille'
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

// L'icône nue, sans sceau (connu, inconnu) : 34 px dans la toile d'un sceau, un peu au-dessus du
// centre pour laisser place à son ombre.
const [ICONE, BORD] = [34, 9]

// Une lueur légère, juste sous la marque, couleur parchemin des terres : elle soutient le signe sans se
// voir (Uriel, 24/10 : « très léger, juste en dessous »).
function lueur(ctx: OffscreenCanvasRenderingContext2D, c: CouleursCarte) {
  const m = ctx.canvas.width / 2
  const rayon = m * 0.65
  const degrade = ctx.createRadialGradient(m, m, 0, m, m, rayon)
  degrade.addColorStop(0, c.fond)
  degrade.addColorStop(0.5, `${c.fond}cc`)
  degrade.addColorStop(1, `${c.fond}00`) // le même parchemin, transparent : la lueur se fond
  disque(ctx, rayon)
  ctx.fillStyle = degrade
  ctx.fill()
}

function sceauConnu(icone: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  lueur(ctx, c)
  ctx.shadowColor = `${c.encre}4d` // une ombre à peine, sous l'icône
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1
  ctx.drawImage(pochoir(icone, ICONE, c.encre), BORD, BORD - 1)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

// Un lieu pas encore découvert : le « ? » au pinceau de la marque (VISUELS/LA CARTE/inconnu_2.webp,
// Uriel 24/10), tel quel, à la taille des icônes.
function bille(image: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  lueur(ctx, c)
  ctx.drawImage(image, BORD, BORD - 1, ICONE, ICONE)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

// Un lieu neuf : un sceau d'encre plein, l'icône (ou le « ? ») en clair (nouveaux.ts pose sa lueur et
// son anneau). Noir et non rouge : le rouge est aux énigmes (Uriel, 24/10).
function sceauNeuf(icone: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  disque(ctx, SCEAU / 2 - 2)
  ctx.fillStyle = c.encre
  ctx.fill()
  poserIcone(ctx, icone, c.halo)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

function sceauVisite(icone: HTMLImageElement, c: CouleursCarte) {
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

// La gélule « NOUVEAU » (nouveaux.ts), mot compris, en une seule image : la carte l'agrandit d'un
// bloc avec le zoom. Une gélule étirée autour d'un texte de carte ne suit pas quand ce texte change
// de taille avec le zoom : le mot glissait dedans (22/10). Mot en Cabin 9 px, marges de 3 et 6 px,
// en clair sur l'encre (Uriel, 24/10).
function geluleNouveau(c: CouleursCarte): ImageData {
  const [mot, haut, cote] = [9 * RATIO, 3 * RATIO, 6 * RATIO]
  const police = `700 ${String(mot)}px Cabin`
  const mesure = toile(1)
  mesure.font = police
  mesure.letterSpacing = `${String(0.08 * mot)}px`
  const { width, actualBoundingBoxAscent: capitale } = mesure.measureText('NOUVEAU')
  const [largeur, hauteur] = [Math.ceil(width) + 2 * cote, Math.ceil(capitale) + 2 * haut]
  const ctx = new OffscreenCanvas(largeur, hauteur).getContext('2d')
  if (!ctx) throw new Error('canevas indisponible')
  ctx.beginPath()
  ctx.roundRect(0, 0, largeur, hauteur, hauteur / 2)
  ctx.fillStyle = c.encre
  ctx.fill()
  ctx.font = police
  ctx.letterSpacing = mesure.letterSpacing
  ctx.fillStyle = c.halo
  ctx.textAlign = 'center'
  // Des capitales : centrées sur leur hauteur réelle, sans la place des jambages.
  ctx.fillText('NOUVEAU', largeur / 2, haut + capitale)
  return ctx.getImageData(0, 0, largeur, hauteur)
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
    if (l.nature !== 'lieu' || (l.etat === 'inconnu' && !l.nouveau)) continue
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
  // La gélule « NOUVEAU » s'écrit en Cabin : la police doit être là avant de dessiner.
  await document.fonts.load('700 17px Cabin')
  const inconnu = await chargerImage(imageInconnu)
  ajouter(map, 'bille', bille(inconnu, c))
  ajouter(map, 'curiosite', etoile(c))
  pilule(map, 'pilule', c.halo, melanger(c.encre, c.halo, 0.45))
  pilule(map, 'pilule-moi', c.encre, c.encre)
  ajouter(map, 'gelule-nouveau', geluleNouveau(c))

  // Chaque image une seule fois (02/10 : dessinée pour chaque lieu, elle coûtait une seconde de
  // calcul sur un PC, bien plus sur un téléphone).
  const aDessiner = marquesADessiner(lieux, couleurTypes, (nom) => map.hasImage(nom))
  await Promise.all(
    [...aDessiner].map(async ([nom, l]) => {
      const dessiner = (icone: HTMLImageElement) => {
        if (l.nouveau) return sceauNeuf(l.etat === 'inconnu' ? inconnu : icone, c)
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
