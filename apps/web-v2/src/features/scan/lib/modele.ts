/**
 * QUOI     — le modèle de vision du scan (MediaPipe Image Embedder, MobileNet V3 small) : il résume
 *            une image en une empreinte de 1 024 nombres, normalisée.
 * POURQUOI — chargé à part et une seule fois : le reste de l'appli ne grossit pas (import dynamique).
 *            Ses fichiers sont servis par Explore sous /modeles/ et gardés par le service worker.
 *            Le nom du modèle accompagne chaque empreinte en base : en changer invalide les anciennes.
 * ATTENTION — essayer le GPU, retomber sur le CPU. Un échec se rejoue au prochain appel.
 */
export const MODELE = 'mobilenet_v3_small'

export type Empreinteur = (image: HTMLCanvasElement) => number[]

const DOSSIER = `${import.meta.env.BASE_URL}modeles`
let chargement: Promise<Empreinteur> | null = null

async function charger(): Promise<Empreinteur> {
  const { FilesetResolver, ImageEmbedder } = await import('@mediapipe/tasks-vision')
  const fichiers = await FilesetResolver.forVisionTasks(`${DOSSIER}/wasm`)
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: `${DOSSIER}/${MODELE}.tflite`, delegate },
    runningMode: 'IMAGE' as const,
    l2Normalize: true,
    quantize: false,
  })
  const modele = await ImageEmbedder.createFromOptions(fichiers, options('GPU')).catch(() =>
    ImageEmbedder.createFromOptions(fichiers, options('CPU')),
  )
  return (image) => Array.from(modele.embed(image).embeddings[0]?.floatEmbedding ?? [])
}

export function chargerModele(): Promise<Empreinteur> {
  chargement ??= charger().catch((erreur: unknown) => {
    chargement = null
    throw erreur
  })
  return chargement
}
