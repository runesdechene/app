// L'envoi par Resend, un lot de 100 au plus (le maximum de l'API). Chaque appel porte une clé
// d'idempotence : si un réveil renvoie ce que Resend a déjà pris, Resend l'ignore (24 h).
// Un lot refusé pour un message invalide (422) l'est en entier ; ses messages repartent alors un par un,
// pour noter chaque refus et laisser partir les autres. Toute autre panne (5xx, 429) ne renvoie rien :
// le lot est noté en échec, plutôt que de risquer un double envoi.

export type MessageResend = {
  from: string
  to: string[]
  reply_to: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

/** `cle` : la clé d'idempotence de ce message, stable d'un réveil à l'autre (« missive-personne »). */
export type AEnvoyer = { message: MessageResend; cle: string }
export type Resultat = { id: string } | { erreur: string }

export const TAILLE_DU_LOT_RESEND = 100

const API = 'https://api.resend.com'

export async function envoyerLot(lot: AEnvoyer[], cleApi: string): Promise<Resultat[]> {
  const cleDuLot = `lot-${lot[0]?.cle ?? ''}-${lot.at(-1)?.cle ?? ''}-${String(lot.length)}`
  const r = await appeler('/emails/batch', lot.map((m) => m.message), cleApi, cleDuLot)
  if (r.ok) {
    const { data } = (await r.json()) as { data: { id: string }[] }
    return data
  }
  if (r.status !== 422) return lot.map(() => ({ erreur: `Resend indisponible (HTTP ${String(r.status)})` }))
  const resultats: Resultat[] = []
  for (const m of lot) resultats.push(await envoyerSeul(m, cleApi))
  return resultats
}

async function envoyerSeul(m: AEnvoyer, cleApi: string): Promise<Resultat> {
  const r = await appeler('/emails', m.message, cleApi, m.cle)
  const corps = (await r.json().catch(() => ({}))) as { id?: string; message?: string }
  return r.ok && corps.id ? { id: corps.id } : { erreur: corps.message ?? `HTTP ${String(r.status)}` }
}

function appeler(chemin: string, corps: unknown, cleApi: string, idempotence: string) {
  return fetch(`${API}${chemin}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cleApi}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotence },
    body: JSON.stringify(corps),
  })
}
