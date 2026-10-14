/**
 * QUOI     — l'appel des fonctions Netlify (Shopify, compte du stand) avec le jeton de session.
 * POURQUOI — les fonctions refusent qui n'est pas admin : le jeton part avec chaque appel. Un échec
 *            (fonction absente, 403, erreur Shopify relayée) devient un message lisible, jamais
 *            « Unexpected token '<' ».
 * ATTENTION — en local `vite` ne sert pas les fonctions : elles se testent sur le site de préparation.
 */
import { supabase } from '@/shared/supabase/client'

interface Appel {
  methode?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  corps?: unknown
  parametres?: Record<string, string>
}

export async function appelerFonction(nom: string, init: Appel = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Session expirée : reconnecte-toi.')

  const recherche = init.parametres ? `?${new URLSearchParams(init.parametres).toString()}` : ''
  const headers: Record<string, string> = { Authorization: `Bearer ${data.session.access_token}` }
  if (init.corps !== undefined) headers['Content-Type'] = 'application/json'

  const options: RequestInit = { method: init.methode ?? 'GET', headers }
  if (init.corps !== undefined) options.body = JSON.stringify(init.corps)
  return fetch(`/.netlify/functions/${nom}${recherche}`, options)
}

function lireJson(texte: string): unknown {
  try {
    return JSON.parse(texte)
  } catch {
    return undefined
  }
}

function champ(corps: unknown, nom: string): unknown {
  return typeof corps === 'object' && corps !== null && nom in corps
    ? (corps as Record<string, unknown>)[nom]
    : undefined
}

export async function lireReponse<T>(r: Response): Promise<T> {
  const corps = lireJson(await r.text())
  if (corps === undefined) {
    throw new Error(
      `Les fonctions Netlify ne répondent pas (HTTP ${String(r.status)}). En local elles ne tournent pas : tester sur le site de préparation.`,
    )
  }
  const erreur = champ(corps, 'error')
  if (typeof erreur === 'string') throw new Error(erreur)
  if (!r.ok) {
    const erreurs = champ(corps, 'errors')
    if (typeof erreurs === 'string') throw new Error(erreurs)
    throw new Error(erreurs === undefined ? `HTTP ${String(r.status)}` : JSON.stringify(erreurs))
  }
  return corps as T
}
