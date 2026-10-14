/**
 * QUOI     — les fichiers d'une ou plusieurs contributions, et leur téléchargement : une archive .zip,
 *            ou le fichier seul quand il n'y en a qu'un.
 * POURQUOI — `jszip` est lourd et rarement utile : il se charge au premier téléchargement, pas avec l'écran.
 *            Un fichier qui ne se lit pas est compté, il ne bloque pas les autres.
 */
import type { Contribution } from '../api/contributions'
import { nomDeFichier } from './contribution'

export type Fichier = { url: string; nom: string }

export function fichiersDeContributions(cs: Contribution[]): Fichier[] {
  return cs.flatMap((c) => c.images.map((photo, rang) => ({ url: photo.url, nom: nomDeFichier(c.nom, c.instagram, rang, photo.url) })))
}

function enregistrer(contenu: Blob, nom: string) {
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(contenu)
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(lien.href)
}

async function lire(fichier: Fichier): Promise<Blob | null> {
  try {
    const reponse = await fetch(fichier.url)
    return reponse.ok ? await reponse.blob() : null
  } catch {
    return null
  }
}

// Deux contributions au même nom donneraient deux « Brune - 1.webp » : le second prend « (2) ».
function nomLibre(archive: { file(nom: string): unknown }, nom: string): string {
  if (!archive.file(nom)) return nom
  const point = nom.lastIndexOf('.')
  const racine = point === -1 ? nom : nom.slice(0, point)
  const extension = point === -1 ? '' : nom.slice(point)
  for (let n = 2; ; n += 1) {
    const essai = `${racine} (${String(n)})${extension}`
    if (!archive.file(essai)) return essai
  }
}

/** `onProgres(i, n)` : le fichier i sur n vient d'être lu. */
export async function telechargerArchive(
  fichiers: Fichier[], nomDArchive: string, onProgres?: (fait: number, total: number) => void,
): Promise<{ ok: number; manques: number }> {
  const lus: { nom: string; contenu: Blob }[] = []
  let manques = 0
  for (const [rang, fichier] of fichiers.entries()) {
    const contenu = await lire(fichier)
    if (contenu) lus.push({ nom: fichier.nom, contenu })
    else manques += 1
    onProgres?.(rang + 1, fichiers.length)
  }

  const premier = lus[0]
  if (lus.length === 1 && premier) {
    enregistrer(premier.contenu, premier.nom)
  } else if (lus.length > 1) {
    const { default: JSZip } = await import('jszip')
    const archive = new JSZip()
    for (const { nom, contenu } of lus) archive.file(nomLibre(archive, nom), contenu)
    enregistrer(await archive.generateAsync({ type: 'blob' }), nomDArchive)
  }
  return { ok: lus.length, manques }
}
