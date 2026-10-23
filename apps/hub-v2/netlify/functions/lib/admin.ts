// La garde des fonctions réservées à l'équipe : une session Supabase valide, et le rôle admin en base.
// shortcut: les fonctions plus anciennes (stand, Shopify) portent chacune leur copie ; à remplacer par celle-ci
// au prochain passage dans l'une d'elles.

export async function exigerAdmin(request: Request): Promise<{ userId: string } | { error: string; status: number }> {
  const url = process.env.VITE_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!bearer) return { error: 'Missing Authorization header', status: 401 }

  const userResp = await fetch(`${url}/auth/v1/user`, { headers: { 'apikey': cle ?? '', 'Authorization': `Bearer ${bearer}` } })
  if (!userResp.ok) return { error: 'Invalid session', status: 401 }
  const user = (await userResp.json()) as { id?: string }
  if (!user.id) return { error: 'Invalid session', status: 401 }

  const roleResp = await fetch(`${url}/rest/v1/users?select=role&id=eq.${encodeURIComponent(user.id)}`, {
    headers: { 'apikey': cle ?? '', 'Authorization': `Bearer ${cle ?? ''}` },
  })
  if (!roleResp.ok) return { error: 'Failed to verify role', status: 500 }
  const rows = (await roleResp.json()) as Array<{ role?: string }>
  if (rows[0]?.role !== 'admin') return { error: 'Forbidden — admin only', status: 403 }
  return { userId: user.id }
}
