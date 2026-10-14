/**
 * QUOI     — l'étiquette de provenance d'un client Shopify (source:app ou source:shopify, app-player pour
 *            les joueurs), la préparation des lots d'envoi et l'envoi lot par lot avec son compte rendu.
 * POURQUOI — on n'écrase jamais les étiquettes d'un client : on les relit, on ajoute, on renvoie le tout.
 *            Un client qui a déjà une source n'est pas touché. Un lot qui échoue est compté et nommé, les
 *            suivants partent quand même : aucun succès partiel n'est silencieux.
 */
import type { ClientShopify } from '../api/shopify'

export type CompteClient = { email: string; client: number; provenance: string | null }
export type Etiquetage = { customerId: number; email: string; tags: string }
export type Progres = { fait: number; total: number; erreurs: string[]; erreursCompte: number }
export type ReponseEtiquetage = { email: string; success: boolean; reason?: string }

const TAILLE_DU_LOT = 25

/** Les étiquettes à poser sur le client, ou null s'il n'y a rien à faire (client absent, source déjà posée). */
export function etiquettesDeProvenance(compte: CompteClient, client: ClientShopify | undefined): string | null {
  if (!client) return null
  const actuelles = client.tags.split(',').map((t) => t.trim()).filter(Boolean)
  if (actuelles.some((t) => t.startsWith('source:'))) return null
  const ajoutees = compte.provenance === 'shopify' ? ['source:shopify'] : ['source:app', 'app-player']
  return [...new Set([...actuelles, ...ajoutees])].join(', ')
}

/** Les comptes à étiqueter, un par client Shopify, en lots de 25 ; `ignores` : les comptes sans rien à poser. */
export function preparerEtiquetage(comptes: CompteClient[], clients: ClientShopify[]): { lots: Etiquetage[][]; ignores: number } {
  const parId = new Map(clients.map((c) => [c.id, c]))
  const vus = new Set<number>()
  const aPoser: Etiquetage[] = []
  let ignores = 0
  for (const compte of comptes) {
    if (vus.has(compte.client)) { ignores += 1; continue }
    vus.add(compte.client)
    const tags = etiquettesDeProvenance(compte, parId.get(compte.client))
    if (tags === null) ignores += 1
    else aPoser.push({ customerId: compte.client, email: compte.email, tags })
  }
  const lots: Etiquetage[][] = []
  for (let i = 0; i < aPoser.length; i += TAILLE_DU_LOT) lots.push(aPoser.slice(i, i + TAILLE_DU_LOT))
  return { lots, ignores }
}

const pause = (ms: number) => new Promise<void>((fin) => { setTimeout(fin, ms) })

/** Envoie les lots un par un ; `pauseMs` entre deux lots laisse le seau GraphQL de Shopify se remplir. */
export async function envoyerParLots(
  lots: Etiquetage[][],
  envoyer: (lot: Etiquetage[]) => Promise<ReponseEtiquetage[]>,
  onProgres: (p: Progres) => void,
  pauseMs = 1000,
): Promise<Progres> {
  const progres: Progres = { fait: 0, total: lots.reduce((n, l) => n + l.length, 0), erreurs: [], erreursCompte: 0 }
  for (const [i, lot] of lots.entries()) {
    if (i > 0) await pause(pauseMs)
    try {
      const reponses = await envoyer(lot)
      for (const r of reponses) {
        if (r.success) continue
        progres.erreurs.push(`${r.email} — ${r.reason ?? 'Erreur inconnue'}`)
        progres.erreursCompte += 1
      }
      // Shopify a pu répondre pour moins de clients qu'il n'en a reçu : les absents ne sont pas des succès.
      const repondus = new Set(reponses.map((r) => r.email))
      for (const absent of lot.filter((e) => !repondus.has(e.email))) {
        progres.erreurs.push(`${absent.email} — Pas de réponse de Shopify`)
        progres.erreursCompte += 1
      }
    } catch (e) {
      progres.erreurs.push(`Lot ${String(i + 1)} — erreur réseau : ${e instanceof Error ? e.message : String(e)}`)
      progres.erreursCompte += lot.length
    }
    progres.fait += lot.length
    onProgres({ ...progres, erreurs: [...progres.erreurs] })
  }
  return progres
}
