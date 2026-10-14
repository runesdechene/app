/**
 * QUOI     — les empreintes de scan des illustrations d'un Fragment : chaque illustration (claire,
 *            sombre) posée sur fond blanc et sur fond noir, entière et recadrée au centre, passe au
 *            même modèle que le scanner d'Explore.
 * POURQUOI — le socle des références du scan : elles ne bipent jamais à tort (essai du 09/10). Le modèle
 *            et ses wasm viennent d'Explore (/modeles/, ouverts par CORS) : le Hub et le téléphone
 *            calculent exactement pareil.
 * ATTENTION — la préparation (256 px, 90 %, fonds, zooms) doit rester celle de l'essai. MediaPipe n'est
 *            chargé qu'au premier calcul.
 */
import type { ImageEmbedder } from '@mediapipe/tasks-vision'

const DOSSIER = 'https://app.runesdechene.com/modeles'
const MODELE_TFLITE = 'mobilenet_v3_small'
const COTE = 256

let chargement: Promise<ImageEmbedder> | null = null

async function creerLeModele(): Promise<ImageEmbedder> {
  const { FilesetResolver, ImageEmbedder } = await import('@mediapipe/tasks-vision')
  const fichiers = await FilesetResolver.forVisionTasks(`${DOSSIER}/wasm`)
  return ImageEmbedder.createFromOptions(fichiers, {
    baseOptions: { modelAssetPath: `${DOSSIER}/${MODELE_TFLITE}.tflite` },
    runningMode: 'IMAGE',
    l2Normalize: true,
    quantize: false,
  })
}

function modele(): Promise<ImageEmbedder> {
  chargement ??= creerLeModele().catch((erreur: unknown) => {
    chargement = null // un échec (Explore pas encore déployé, réseau) se rejoue au prochain clic
    throw erreur
  })
  return chargement
}

function charger(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => { ok(image) }
    image.onerror = () => { ko(new Error(`image refusée : ${src}`)) }
    image.src = src
  })
}

function poser(image: HTMLImageElement, fond: string, zoom: number): HTMLCanvasElement {
  const toile = document.createElement('canvas')
  toile.width = COTE
  toile.height = COTE
  const ctx = toile.getContext('2d')
  if (!ctx) throw new Error('pas de canvas')
  ctx.fillStyle = fond
  ctx.fillRect(0, 0, COTE, COTE)
  const echelle = Math.min(COTE / image.width, COTE / image.height) * 0.9 * zoom
  const l = image.width * echelle
  const h = image.height * echelle
  ctx.drawImage(image, (COTE - l) / 2, (COTE - h) / 2, l, h)
  return toile
}

const arrondir = (v: Float32Array | number[]) => Array.from(v, (x) => Math.round(x * 1e4) / 1e4)

export async function calculerEmpreintes(urls: (string | null)[]): Promise<number[][]> {
  const embedder = await modele()
  const vecteurs: number[][] = []
  for (const url of urls) {
    if (!url) continue
    const image = await charger(url)
    for (const fond of ['#ffffff', '#161616']) {
      for (const zoom of [1, 1.5]) {
        const e = embedder.embed(poser(image, fond, zoom)).embeddings[0]?.floatEmbedding
        if (e) vecteurs.push(arrondir(e))
      }
    }
  }
  return vecteurs
}
