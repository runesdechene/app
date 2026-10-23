// L'envoi par Resend : par lots de 100 (le maximum de l'API). Un lot refusé l'est en entier ; ses messages
// repartent alors un par un, pour que chaque refus soit noté avec sa raison et que les autres partent.

export type MessageResend = {
  from: string
  to: string[]
  reply_to: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export type Resultat = { id: string } | { erreur: string }

const API = 'https://api.resend.com'

export async function envoyerParLots(messages: MessageResend[], cle: string): Promise<Resultat[]> {
  const resultats: Resultat[] = []
  for (let i = 0; i < messages.length; i += 100) {
    const lot = messages.slice(i, i + 100)
    const r = await appeler('/emails/batch', lot, cle)
    if (r.ok) {
      const { data } = (await r.json()) as { data: { id: string }[] }
      resultats.push(...data)
    } else {
      for (const message of lot) resultats.push(await envoyerSeul(message, cle))
    }
  }
  return resultats
}

async function envoyerSeul(message: MessageResend, cle: string): Promise<Resultat> {
  const r = await appeler('/emails', message, cle)
  const corps = (await r.json().catch(() => ({}))) as { id?: string; message?: string }
  return r.ok && corps.id ? { id: corps.id } : { erreur: corps.message ?? `HTTP ${String(r.status)}` }
}

function appeler(chemin: string, corps: unknown, cle: string) {
  return fetch(`${API}${chemin}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
}
