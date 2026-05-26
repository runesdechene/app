import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface UserInfo {
  id: string
  email_address: string
  first_name: string | null
  display_name: string | null
  role: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
  faction_id: string | null
  account_source: string | null
  shopify_customer_id: number | null
  avatar_url: string | null
  notoriety_points: number
  exploration_points: number
  erudition_points: number
  energy_points: number
  max_energy: number
  game_mode: string | null
  user_crowns: { balance: number } | null
}

interface FactionInfo {
  id: string
  title: string
  color: string
}

interface FragmentInfo {
  fragment_id: number
  unlocked_at: string
  source: string
  fragment: {
    id: number
    name: string
    icon: string | null
    image_url: string | null
    bonus_type: string | null
    bonus_value: number
    ability_type: string | null
  }
}

interface PurchaseLog {
  id: number
  email: string
  shopify_order_id: string | null
  shopify_tag: string | null
  unlock_type: string | null
  unlock_ref_id: number | null
  status: string
  created_at: string
}

interface ShopifyUnlock {
  id: number
  shopify_tag: string
  unlock_ref_id: number
}

export function UserDetail() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const [user, setUser] = useState<UserInfo | null>(null)
  const [faction, setFaction] = useState<FactionInfo | null>(null)
  const [fragments, setFragments] = useState<FragmentInfo[]>([])
  const [purchaseLogs, setPurchaseLogs] = useState<PurchaseLog[]>([])
  const [allUnlocks, setAllUnlocks] = useState<ShopifyUnlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    fetchAll()
  }, [userId])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      // Fetch user
      const { data: userData, error: userErr } = await supabase
        .from('users')
        .select('id, email_address, first_name, display_name, role, is_active, created_at, last_login_at, faction_id, account_source, shopify_customer_id, avatar_url, notoriety_points, exploration_points, erudition_points, energy_points, max_energy, game_mode, user_crowns(balance)')
        .eq('id', userId!)
        .single()

      if (userErr || !userData) {
        setError('Utilisateur introuvable')
        return
      }
      const u = userData as unknown as UserInfo
      setUser(u)

      // Fetch faction, fragments, purchase_log, shopify_unlocks in parallel
      const [factionRes, fragmentsRes, logsRes, unlocksRes] = await Promise.all([
        u.faction_id
          ? supabase.from('factions').select('id, title, color').eq('id', u.faction_id).single()
          : Promise.resolve({ data: null }),
        supabase
          .from('user_fragments')
          .select('fragment_id, unlocked_at, source, fragment:title_fragments(id, name, icon, image_url, bonus_type, bonus_value, ability_type)')
          .eq('user_id', u.id)
          .order('unlocked_at', { ascending: false }),
        supabase
          .from('purchase_log')
          .select('id, email, shopify_order_id, shopify_tag, unlock_type, unlock_ref_id, status, created_at')
          .eq('user_id', u.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('shopify_unlocks')
          .select('id, shopify_tag, unlock_ref_id')
      ])

      if (factionRes.data) setFaction(factionRes.data as FactionInfo)
      if (fragmentsRes.data) setFragments(fragmentsRes.data as unknown as FragmentInfo[])
      if (logsRes.data) setPurchaseLogs(logsRes.data as PurchaseLog[])
      if (unlocksRes.data) setAllUnlocks(unlocksRes.data as ShopifyUnlock[])

      // Also fetch purchase_log by email (may include entries without user_id)
      if (u.email_address) {
        const { data: emailLogs } = await supabase
          .from('purchase_log')
          .select('id, email, shopify_order_id, shopify_tag, unlock_type, unlock_ref_id, status, created_at')
          .eq('email', u.email_address.toLowerCase())
          .order('created_at', { ascending: false })

        if (emailLogs) {
          // Merge: add any logs not already in the user_id set
          const existingIds = new Set(purchaseLogs.map(l => l.id))
          const merged = [...purchaseLogs]
          for (const log of emailLogs as PurchaseLog[]) {
            if (!existingIds.has(log.id)) {
              merged.push(log)
            }
          }
          merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          setPurchaseLogs(merged)
        }
      }
    } catch (err) {
      setError(`Erreur: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Chargement...</div>
  if (error || !user) return (
    <div>
      <button className="ud-back" onClick={() => navigate('/users')}>&larr; Retour</button>
      <div className="ud-error">{error || 'Utilisateur introuvable'}</div>
    </div>
  )

  const sourceLabel = user.account_source === 'shopify'
    ? '🛒 Shopify'
    : '🗺️ App'

  return (
    <div className="ud">
      <button className="ud-back" onClick={() => navigate('/users')}>&larr; Retour aux utilisateurs</button>

      {/* Header */}
      <div className="ud-header">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="ud-avatar" />
        ) : (
          <div className="ud-avatar-fallback">
            {(user.display_name || user.first_name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="ud-header-info">
          <h1 className="ud-name">{user.display_name || user.first_name || 'Sans nom'}</h1>
          <span className="ud-email">{user.email_address}</span>
        </div>
      </div>

      {/* Info cards */}
      <div className="ud-cards">
        <div className="ud-card">
          <div className="ud-card-label">Source</div>
          <div className="ud-card-value">{sourceLabel}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Role</div>
          <div className="ud-card-value">{user.role}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Heritage</div>
          <div className="ud-card-value" style={faction ? { color: faction.color } : undefined}>
            {faction ? faction.title : 'Aucun'}
          </div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Gloire</div>
          <div className="ud-card-value">{(user.exploration_points ?? 0) + (user.erudition_points ?? 0)} 🎖️</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Exploration</div>
          <div className="ud-card-value">{user.exploration_points ?? 0}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Erudition</div>
          <div className="ud-card-value">{user.erudition_points ?? 0}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Couronnes</div>
          <div className="ud-card-value">{user.user_crowns?.balance ?? 0} 🪙</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Energie</div>
          <div className="ud-card-value">{user.energy_points} / {user.max_energy}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Shopify ID</div>
          <div className="ud-card-value">{user.shopify_customer_id ?? 'Aucun'}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Inscription</div>
          <div className="ud-card-value">{new Date(user.created_at).toLocaleDateString('fr-FR')}</div>
        </div>
        <div className="ud-card">
          <div className="ud-card-label">Derniere connexion</div>
          <div className="ud-card-value">
            {user.last_login_at
              ? new Date(user.last_login_at).toLocaleDateString('fr-FR')
              : 'Jamais'}
          </div>
        </div>
      </div>

      {/* Fragments */}
      <div className="ud-section">
        <h2>Fragments ({fragments.length})</h2>
        {fragments.length === 0 ? (
          <p className="ud-empty">Aucun fragment</p>
        ) : (
          <div className="ud-fragments-grid">
            {fragments.map(f => (
              <div key={f.fragment_id} className="ud-fragment">
                {f.fragment?.image_url ? (
                  <img src={f.fragment.image_url} alt="" className="ud-fragment-img" />
                ) : f.fragment?.icon ? (
                  <span className="ud-fragment-icon">{f.fragment.icon}</span>
                ) : (
                  <span className="ud-fragment-icon">?</span>
                )}
                <div className="ud-fragment-info">
                  <span className="ud-fragment-name">{f.fragment?.name ?? `#${f.fragment_id}`}</span>
                  <span className="ud-fragment-meta">
                    Source: {f.source} — {new Date(f.unlocked_at).toLocaleDateString('fr-FR')}
                  </span>
                  {f.fragment?.bonus_type && (
                    <span className="ud-fragment-bonus">
                      {f.fragment.bonus_value > 0 ? '+' : ''}{f.fragment.bonus_value} {f.fragment.bonus_type}
                    </span>
                  )}
                  {f.fragment?.ability_type && (
                    <span className="ud-fragment-ability">⚡ {f.fragment.ability_type}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Log */}
      <div className="ud-section">
        <h2>Purchase Log ({purchaseLogs.length})</h2>
        {purchaseLogs.length === 0 ? (
          <p className="ud-empty">Aucun achat enregistre</p>
        ) : (
          <table className="ud-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Type</th>
                <th>Ref ID</th>
                <th>Tag Shopify</th>
                <th>Order ID</th>
              </tr>
            </thead>
            <tbody>
              {purchaseLogs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                  <td>
                    <span className={`ud-status ud-status-${log.status.replace('_', '-')}`}>{log.status}</span>
                  </td>
                  <td>{log.unlock_type || '-'}</td>
                  <td>{log.unlock_ref_id ?? '-'}</td>
                  <td>{log.shopify_tag || '-'}</td>
                  <td style={{ fontSize: 11 }}>{log.shopify_order_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Debug: Shopify Unlocks mappings */}
      <div className="ud-section">
        <h2>Shopify Unlocks (mappings actifs : {allUnlocks.length})</h2>
        <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: 8 }}>
          Ces mappings lient un tag Shopify produit a un fragment. Si le tag du produit achete n'est pas dans cette liste, le fragment ne sera pas attribue.
        </p>
        {allUnlocks.length === 0 ? (
          <p className="ud-empty">Aucun mapping configure</p>
        ) : (
          <table className="ud-table">
            <thead>
              <tr>
                <th>Tag Shopify</th>
                <th>Fragment ID</th>
              </tr>
            </thead>
            <tbody>
              {allUnlocks.map(u => (
                <tr key={u.id}>
                  <td><code>{u.shopify_tag}</code></td>
                  <td>{u.unlock_ref_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
