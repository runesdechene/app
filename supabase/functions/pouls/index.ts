// Supabase Edge Function : pouls
// POST endpoint appelé par le mod « pouls » de Claude Code, qui ne peut pas tenir une session admin.
// - Lit pouls_secret depuis app_settings (pas de Supabase secrets, comme send-push — tout en DB)
// - Vérifie l'header X-Pouls-Secret, puis la période du corps {"periode": "jour"|"semaine"|"mois"|"toujours"}
// - Lit les six chiffres du pouls du Hub (et ceux de la période d'avant) par _hub_pouls_periode,
//   sous la clé service_role. Rien d'autre ne sort : jamais un message de la base.
// Spec : docs/superpowers/specs/2026-10-18-mod-pouls-claude-code-design.md

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { miseEnForme, periodeValide, secretValide } from './reponse.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Le secret se relit au bout d'une minute : changer la ligne en base révoque l'ancien sans attendre
// que l'instance soit recyclée (conception §6.1).
const DUREE_CACHE_MS = 60_000
let cache: { secret: string; lu_a: number } | null = null

async function loadSecret(): Promise<string | null> {
  if (cache && Date.now() - cache.lu_a < DUREE_CACHE_MS) return cache.secret
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'pouls_secret')
    .maybeSingle()
  if (error) {
    console.error('pouls_secret_lookup_failed', error)
    return null
  }
  if (!data?.value) {
    console.error('pouls_secret_missing')
    cache = null
    return null
  }
  cache = { secret: data.value, lu_a: Date.now() }
  return cache.secret
}

const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

serve(async (req) => {
  // 1. Le secret d'abord : sans lui, l'appelant n'apprend rien du reste.
  const attendu = await loadSecret()
  if (!attendu) return reponse({ erreur: 'base' }, 503)
  if (!secretValide(req.headers.get('x-pouls-secret'), attendu)) {
    return reponse({ erreur: 'secret' }, 401)
  }

  // 2. La période (un corps illisible vaut une période absente).
  const corps: { periode?: unknown } | null = await req.json().catch(() => null)
  const periode = corps?.periode
  if (!periodeValide(periode)) return reponse({ erreur: 'periode' }, 400)

  // 3. Les chiffres. Le détail de l'erreur reste dans les journaux.
  const { data, error } = await supabase.rpc('_hub_pouls_periode', { p_periode: periode })
  if (error) {
    console.error('pouls_rpc_failed', error)
    return reponse({ erreur: 'base' }, 503)
  }

  try {
    return reponse(miseEnForme(periode, data, new Date().toISOString()))
  } catch (err) {
    console.error('pouls_forme_invalide', err)
    return reponse({ erreur: 'base' }, 503)
  }
})
