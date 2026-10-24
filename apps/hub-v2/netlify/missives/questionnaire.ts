// Source : `pnpm build` l'empaquette en un seul fichier dans netlify/functions (build:fonctions, voir le README).
// Le questionnaire « Dis-nous qui tu es », page publique /qui-es-tu, sans compte :
//   GET  ?j=…               → le prénom de la personne du lien, et ses réponses s'il en a déjà donné.
//   POST { jeton, reponses } → les réponses s'écrivent (mig 555), pour la personne du lien seulement.
//   POST { email }           → sans lien : si une fiche porte l'adresse, elle reçoit son lien par e-mail.
// Rien ne s'écrit sans lien signé (usage « questionnaire », lib/jeton.ts) : personne ne remplit la fiche d'un
// autre. Une adresse inconnue reçoit la même réponse qu'une connue : la page ne dit pas qui a un compte.

import { validerReponses } from '@runes/missives'
import { signer, verifier } from '../functions/lib/jeton'
import { EXPEDITEUR, HUB, REPONSES } from '../functions/lib/missive'
import { envoyerLot } from '../functions/lib/resend'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIX_MINUTES = 10 * 60 * 1000
// Au-delà, plus aucun lien ne part dans l'heure : une liste d'adresses ne fait pas du domaine d'envoi un spammeur.
const DEMANDES_PAR_HEURE = 200
const NOMS_PAR_DEFAUT = ['', 'Un Voyageur', 'Client Shopify', 'Pionnier']

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

function base(chemin: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    ...init,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  })
}

async function lire<T>(chemin: string): Promise<T[]> {
  const r = await base(chemin)
  if (!r.ok) throw new Error(`base : HTTP ${String(r.status)}`)
  return (await r.json()) as T[]
}

/** Le prénom d'une fiche, ou null quand c'est un nom posé par défaut. */
function prenom(nom: string | null | undefined): string | null {
  const propre = nom?.trim() ?? ''
  return NOMS_PAR_DEFAUT.includes(propre) ? null : propre
}

async function prenomDe(userId: string): Promise<string | null> {
  const [fiche] = await lire<{ first_name: string | null }>(`users?id=eq.${encodeURIComponent(userId)}&select=first_name`)
  return prenom(fiche?.first_name)
}

/** Une adresse à l'identique, majuscules à part : ni « % », ni « _ », ni « * » (le joker de PostgREST) ne valent joker. */
const filtreAdresse = (email: string) => `email_address=ilike.${encodeURIComponent(email.replace(/[\\%_*]/g, '\\$&'))}`

async function envoyerLeLien(email: string): Promise<void> {
  const depuis = new Date(Date.now() - DIX_MINUTES).toISOString()
  const recentes = await lire<{ le: string }>(`questionnaire_demandes?email=eq.${encodeURIComponent(email)}&le=gte.${encodeURIComponent(depuis)}&select=le`)
  if (recentes.length > 0) return
  const heure = new Date(Date.now() - 6 * DIX_MINUTES).toISOString()
  const deLHeure = await lire<{ le: string }>(`questionnaire_demandes?le=gte.${encodeURIComponent(heure)}&select=le&limit=${String(DEMANDES_PAR_HEURE)}`)
  if (deLHeure.length >= DEMANDES_PAR_HEURE) return
  await base('questionnaire_demandes', { method: 'POST', body: JSON.stringify({ email }) })

  // Deux fiches pour une adresse (casse à part) : toujours la même, la première par identifiant.
  const [fiche] = await lire<{ id: string; first_name: string | null; email_address: string }>(
    `users?${filtreAdresse(email)}&supprime_le=is.null&select=id,first_name,email_address&order=id.asc&limit=1`,
  )
  if (!fiche) return
  const cle = process.env.RESEND_API_KEY
  if (!cle) throw new Error('RESEND_API_KEY manquant')

  const lien = `${HUB}/qui-es-tu?j=${encodeURIComponent(signer(fiche.id, 'questionnaire'))}`
  const salut = prenom(fiche.first_name) ?? 'Explorateur'
  await envoyerLot([{
    cle: `questionnaire-${fiche.id}-${String(Math.floor(Date.now() / DIX_MINUTES))}`,
    message: {
      from: EXPEDITEUR,
      // L'adresse de la fiche, jamais celle tapée : le lien ne va qu'à son propriétaire.
      to: [fiche.email_address],
      reply_to: REPONSES,
      subject: 'Ton lien pour te présenter',
      text: `Salut ${salut},\n\nVoici ton lien pour répondre aux sept questions : ${lien}\n\nSi tu n'as rien demandé, ignore ce message.\n\nUriel`,
      html: `<p>Salut ${salut},</p><p><a href="${lien}">Réponds aux sept questions</a> : deux minutes, et les prochains Fragments te ressembleront.</p><p>Si tu n’as rien demandé, ignore ce message.</p><p>Uriel</p>`,
      headers: {},
    },
  }], cle)
}

export default async function handler(request: Request, context?: { waitUntil?: (p: Promise<unknown>) => void }) {
  try {
    if (request.method === 'GET') {
      const userId = verifier(new URL(request.url).searchParams.get('j') ?? '', 'questionnaire')
      if (!userId) return json({ error: 'Lien invalide' }, 403)
      const [portrait] = await lire<Record<string, unknown>>(`portraits?user_id=eq.${encodeURIComponent(userId)}&select=epoques,decouverte,amene,plait,attente,departement,anniv_jour,anniv_mois`)
      return json({ prenom: await prenomDe(userId), portrait: portrait ?? null })
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const corps = (await request.json().catch(() => ({}))) as { jeton?: unknown; reponses?: unknown; email?: unknown }

    if (typeof corps.email === 'string') {
      const email = corps.email.trim().toLowerCase()
      if (!EMAIL_VALIDE.test(email)) return json({ error: 'Adresse invalide' }, 400)
      // La réponse n'attend pas l'envoi : sa durée ne dit pas si l'adresse a un compte.
      const envoi = envoyerLeLien(email).catch((e: unknown) => { console.error('questionnaire : lien non envoyé,', e instanceof Error ? e.message : 'erreur inconnue') })
      if (context?.waitUntil) context.waitUntil(envoi)
      else await envoi
      return json({ ok: true })
    }

    const userId = typeof corps.jeton === 'string' ? verifier(corps.jeton, 'questionnaire') : null
    if (!userId) return json({ error: 'Lien invalide' }, 403)
    const reponses = validerReponses(corps.reponses)
    if (!reponses) return json({ error: 'Réponses invalides' }, 400)
    const r = await base('rpc/questionnaire_repondre', { method: 'POST', body: JSON.stringify({ p_user: userId, p: reponses }) })
    if (!r.ok) {
      console.error('questionnaire : la base a refusé, HTTP', r.status)
      return json({ error: 'Tes réponses n’ont pas pu s’enregistrer, réessaie dans un instant.' }, 500)
    }
    return json({ ok: true, prenom: await prenomDe(userId) })
  } catch (erreur) {
    console.error('questionnaire :', erreur instanceof Error ? erreur.message : 'erreur inconnue')
    return json({ error: 'Unexpected error' }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/questionnaire',
}
