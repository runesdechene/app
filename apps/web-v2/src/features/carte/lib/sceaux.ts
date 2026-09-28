/**
 * QUOI     — les marques des lieux, dessinées une fois dans un canevas puis confiées à MapLibre :
 *            la bille « ? » (lieu inconnu), le sceau crème (connu), le sceau d'encre (visité),
 *            l'étoile (point d'intérêt) et le sceau des groupes.
 * POURQUOI — des images de carte, et non des éléments HTML : des milliers de lieux restent
 *            fluides sur un téléphone (spec Carte §3).
 * ATTENTION — une icône de type qui ne se charge pas retombe sur le losange par défaut : jamais
 *            une marque vide. Dessin en pixelRatio 2 (52 px = 26 px à l'écran).
 */
import type { Map as Carte } from 'maplibre-gl'
import iconeDefaut from '@/assets/ui/sceau-defaut.svg'
import type { LieuCarte } from '../api/lireCarte'
import type { CouleursCarte } from './couleurs'

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

async function chargerIcone(src: string | null): Promise<HTMLImageElement> {
  if (src === null) return chargerImage(iconeDefaut)
  return chargerImage(src).catch(() => chargerImage(iconeDefaut))
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

function poserIcone(ctx: OffscreenCanvasRenderingContext2D, icone: HTMLImageElement, teinte: string) {
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

// « Mes lieux en couleur » : la couleur du type, désaturée, en trois vagues douces (plus claire
// en haut, plus profonde en bas), icône blanche, sans bordure (prototype gravure-couleur).
function sceauCouleur(icone: HTMLImageElement, couleur: string) {
  const ctx = toile(SCEAU)
  const teinte = melanger(couleur, '#8c7c66', 0.58)
  const profond = (part: number) => melanger(teinte, '#1f1a14', part)
  disque(ctx, SCEAU / 2 - 2)
  ctx.save()
  ctx.clip()
  ctx.fillStyle = melanger(teinte, '#ffffff', 0.82)
  ctx.fillRect(0, 0, SCEAU, SCEAU)
  const vague = (x: number, y: number, teinteVague: string) => {
    ctx.beginPath()
    ctx.ellipse(x * SCEAU, y * SCEAU, SCEAU * 0.75, SCEAU * 0.3, 0, 0, Math.PI * 2)
    ctx.fillStyle = teinteVague
    ctx.fill()
  }
  vague(0.35, 0.78, teinte)
  vague(0.8, 1, profond(0.9))
  vague(0.25, 1.18, profond(0.78))
  ctx.restore()
  poserIcone(ctx, icone, '#fff')
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
}

function bille(c: CouleursCarte) {
  const ctx = toile(PETIT)
  disque(ctx, PETIT / 2 - 1.5)
  ctx.globalAlpha = 0.75
  ctx.fillStyle = c.halo
  ctx.fill()
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 2.4
  ctx.strokeStyle = c.encre
  ctx.stroke()
  ctx.globalAlpha = 0.7
  ctx.fillStyle = c.encre
  ctx.font = '700 17px Cabin, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('?', PETIT / 2, PETIT / 2 + 1)
  return ctx.getImageData(0, 0, PETIT, PETIT)
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

function groupe(c: CouleursCarte) {
  const ctx = toile(SCEAU)
  disque(ctx, SCEAU / 2 - 2)
  ctx.fillStyle = c.encre
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = c.halo
  ctx.stroke()
  return ctx.getImageData(0, 0, SCEAU, SCEAU)
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
  ajouter(map, 'groupe', groupe(c))

  const connus = lieux.filter((l) => l.nature === 'lieu' && l.etat !== 'inconnu')
  const icones = new Map(connus.map((l) => [l.icone, chargerIcone(l.icone)]))
  await Promise.all(
    connus.map(async (l) => {
      const icone = await (icones.get(l.icone) ?? chargerIcone(null))
      const nom = nomImage(l, couleurTypes)
      if (map.hasImage(nom)) return
      if (l.etat === 'connu') ajouter(map, nom, sceauConnu(icone, c))
      else if (couleurTypes && l.couleur) ajouter(map, nom, sceauCouleur(icone, l.couleur))
      else ajouter(map, nom, sceauVisite(icone, c))
    }),
  )
}
