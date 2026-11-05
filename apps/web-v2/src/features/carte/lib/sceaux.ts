/**
 * QUOI     — les marques des lieux, dessinées une fois dans un canevas puis confiées à MapLibre :
 *            le « ? » (lieu inconnu) et le lieu connu dans leur bulle crème, ou, en « Carte Skyrim »,
 *            le « ? » au pinceau et l'icône nue à l'encre, sur une lueur parchemin légère ; le sceau
 *            du type (visité, en couleur par défaut depuis le 24/10) ; le
 *            sceau de cire (lieu neuf) ; l'étoile (point d'intérêt), la gélule « NOUVEAU » et l'étendard
 *            posé devant le nom de qui a revendiqué un lieu.
 * POURQUOI — des images de carte, et non des éléments HTML : des milliers de lieux restent
 *            fluides sur un téléphone (spec Carte §3). Les signes d'encre nus (24/10) n'ont pas plu :
 *            les bulles reviennent par défaut, l'encre devient une option (Uriel, 25/10).
 * ATTENTION — une icône de type qui ne se charge ou ne se dessine pas retombe sur le losange par
 *            défaut : jamais une marque vide. Dessin en pixelRatio 2 (52 px = 26 px à l'écran).
 *            Chaque icône ne se télécharge qu'une fois : `prechargerIcones` la demande dès que les
 *            lieux arrivent, pendant que la carte prépare son fond (02/10).
 */
import type { Map as Carte } from 'maplibre-gl'
import iconeDefaut from '@/assets/ui/sceau-defaut.svg'
import imageInconnu from '@/assets/ui/inconnu.webp'
import imageEtendard from '@/assets/ui/etendard.png'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from '@/shared/lib/couleursCarte'

const SCEAU = 52
const PETIT = 26
const RATIO = 2

// Les deux options des Préférences qui changent les marques.
export type StyleDesMarques = { couleurTypes: boolean; skyrim: boolean }

// Le nom de l'image d'un lieu : l'écran le range dans les propriétés de chaque point.
export function nomImage(l: LieuCarte, { couleurTypes, skyrim }: StyleDesMarques): string {
  if (l.nature === 'curiosite') return 'curiosite'
  const icone = l.icone ?? 'defaut'
  if (l.nouveau) return l.etat === 'inconnu' ? 'neuf-inconnu' : `neuf-${icone}`
  if (l.etat === 'inconnu') return skyrim ? 'inconnu-encre' : 'bille'
  if (l.etat === 'connu') return skyrim ? `encre-${icone}` : `connu-${icone}`
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

// Une lueur juste sous la marque, couleur parchemin des terres : elle détache le signe du relief
// (Uriel : « très léger » le 24/10, renforcée le 25/10).
function lueur(ctx: OffscreenCanvasRenderingContext2D, c: CouleursCarte) {
  const m = ctx.canvas.width / 2
  const rayon = m * 0.8
  const degrade = ctx.createRadialGradient(m, m, 0, m, m, rayon)
  degrade.addColorStop(0, c.fond)
  degrade.addColorStop(0.6, `${c.fond}ee`)
  degrade.addColorStop(1, `${c.fond}00`) // le même parchemin, transparent : la lueur se fond
  disque(ctx, rayon)
  ctx.fillStyle = degrade
  ctx.fill()
}

function signeDEncre(icone: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  lueur(ctx, c)
  ctx.shadowColor = `${c.encre}4d` // une ombre à peine, sous l'icône
  ctx.shadowBlur = 2
  ctx.shadowOffsetY = 1
  ctx.drawImage(pochoir(icone, ICONE, c.encre), BORD, BORD - 1)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

// Un lieu pas encore découvert, en « Carte Skyrim » : le « ? » au pinceau de la marque
// (VISUELS/LA CARTE/inconnu_2.webp, Uriel 24/10), tel quel, à la taille des icônes.
function inconnuALEncre(image: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  lueur(ctx, c)
  ctx.drawImage(image, BORD, BORD - 1, ICONE, ICONE)
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

// Un lieu neuf : un sceau de cire rouge, l'icône (ou le « ? ») en clair (nouveaux.ts pose sa lueur et
// son anneau). Passé à l'encre le 24/10, la cire revient le 25/10 (Uriel).
function sceauNeuf(icone: HTMLImageElement, c: CouleursCarte) {
  const ctx = toile(SCEAU)
  disque(ctx, SCEAU / 2 - 2)
  ctx.fillStyle = c.cire
  ctx.fill()
  poserIcone(ctx, icone, c.halo)
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

// Le sceau crème cerclé d'encre : un lieu connu, ou visité quand les couleurs sont éteintes.
function sceauClair(icone: HTMLImageElement, c: CouleursCarte) {
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

// « Mes lieux en couleur » : la pastille de la V1, très appréciée (Uriel, 30/09) — un disque plein
// dans la couleur franche du type, en aplat cerclé de la même couleur plus foncée (Uriel, 25/10), l'icône en blanc.
function sceauCouleur(icone: HTMLImageElement, couleur: string) {
  const ctx = toile(SCEAU)
  disque(ctx, SCEAU / 2 - 3)
  ctx.fillStyle = couleur
  ctx.fill()
  // La bordure : la même couleur, assombrie d'un voile noir (Uriel, 25/10).
  ctx.lineWidth = 3
  ctx.strokeStyle = couleur
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.stroke()
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

// La gélule « NOUVEAU » (nouveaux.ts), mot compris, en une seule image : la carte l'agrandit d'un
// bloc avec le zoom. Une gélule étirée autour d'un texte de carte ne suit pas quand ce texte change
// de taille avec le zoom : le mot glissait dedans (22/10). Mot en Cabin 9 px, marges de 3 et 6 px,
// en clair sur la cire (Uriel, 25/10).
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
  ctx.fillStyle = c.cire
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
  style: StyleDesMarques,
  dejaLa: (nom: string) => boolean,
): Map<string, LieuCarte> {
  const aDessiner = new Map<string, LieuCarte>()
  for (const l of lieux) {
    if (l.nature !== 'lieu' || (l.etat === 'inconnu' && !l.nouveau)) continue
    const nom = nomImage(l, style)
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
  style: StyleDesMarques,
): Promise<void> {
  // La gélule « NOUVEAU » et le « ? » de la bille s'écrivent en Cabin : la police d'abord.
  await document.fonts.load('700 17px Cabin')
  const inconnu = await chargerImage(imageInconnu)
  ajouter(map, 'bille', bille(c))
  ajouter(map, 'inconnu-encre', inconnuALEncre(inconnu, c))
  ajouter(map, 'curiosite', etoile(c))
  // L'étendard de la marque (VISUELS/1. IMAGES EN VRAC/etendard.webp), tel quel.
  // Chargée avant de regarder si elle est déjà là : deux dessins qui se chevauchent l'ajouteraient
  // chacun (« already exists », 25/10).
  const etendard = await chargerImage(imageEtendard)
  if (!map.hasImage('etendard')) map.addImage('etendard', etendard, { pixelRatio: 6 }) // 72 px → 12 px, la hauteur du nom
  ajouter(map, 'gelule-nouveau', geluleNouveau(c))

  // Chaque image une seule fois (02/10 : dessinée pour chaque lieu, elle coûtait une seconde de
  // calcul sur un PC, bien plus sur un téléphone).
  const aDessiner = marquesADessiner(lieux, style, (nom) => map.hasImage(nom))
  await Promise.all(
    [...aDessiner].map(async ([nom, l]) => {
      const dessiner = (icone: HTMLImageElement) => {
        if (l.nouveau) return sceauNeuf(l.etat === 'inconnu' ? inconnu : icone, c)
        if (l.etat === 'connu') return style.skyrim ? signeDEncre(icone, c) : sceauClair(icone, c)
        if (style.couleurTypes && l.couleur) return sceauCouleur(icone, l.couleur)
        return sceauClair(icone, c)
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
