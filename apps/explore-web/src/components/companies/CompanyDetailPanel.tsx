import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCompanyStore } from '../../stores/companyStore'
import { usePlayerStore } from '../../stores/playerStore'
import { CompanyBannerToggle } from './CompanyBannerToggle'
import { CompanyChatPanel } from './CompanyChatPanel'
import { CompanyCreateForm } from './CompanyCreateForm'
import type { CompanyDetail } from '../../stores/companyStore'

interface Props {
  companyId: string
  onClose: () => void
  /** Masque le bouton retour (‹) — utile en sidebar desktop où le hall est la vue directe. */
  hideBack?: boolean
}

export function CompanyDetailPanel({ companyId, onClose, hideBack }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const leave = useCompanyStore((s) => s.leave)
  const removeMember = useCompanyStore((s) => s.removeMember)

  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditForm, setShowEditForm] = useState(false)
  const [leavePending, setLeavePending] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    supabase.rpc('get_company', { p_company_id: companyId }).then(({ data, error: rpcErr }) => {
      if (cancelled) return
      setLoading(false)
      if (rpcErr) {
        setError('Impossible de charger la Compagnie.')
        return
      }
      setDetail(data as CompanyDetail)
    })

    return () => { cancelled = true }
  }, [companyId])

  async function handleLeave() {
    if (!userId || !detail) return
    setLeavePending(true)
    const result = await leave(userId, companyId)
    setLeavePending(false)
    if ('success' in result) {
      onClose()
    }
  }

  async function handleRemove(targetUserId: string) {
    if (!userId) return
    setRemovingId(targetUserId)
    await removeMember(userId, companyId, targetUserId)
    setRemovingId(null)
    // Recharger le détail
    const { data } = await supabase.rpc('get_company', { p_company_id: companyId })
    if (data) setDetail(data as CompanyDetail)
  }

  if (loading) return <div style={s.state}>Chargement…</div>
  if (error || !detail) return <div style={s.state}>{error ?? 'Compagnie introuvable.'}</div>

  const isFounder = detail.founderUserId === userId
  const isActive = activeCompanyId === companyId

  return (
    <div style={s.panel}>
      {/* En-tête */}
      <div style={{ ...s.header, borderColor: detail.color }}>
        {!hideBack && <button style={s.backBtn} onClick={onClose} aria-label="Fermer">‹</button>}

        <div style={s.headerContent}>
          {detail.imageUrl ? (
            <img src={detail.imageUrl} alt="" style={s.emblem} />
          ) : (
            <div style={{ ...s.emblemFallback, backgroundColor: detail.color }}>
              {detail.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 style={s.name}>{detail.name}</h2>
            {detail.description && <p style={s.description}>{detail.description}</p>}
            <span style={s.count}>{detail.memberCount} membre{detail.memberCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Actions fondateur */}
        {isFounder && (
          <button style={s.editBtn} onClick={() => setShowEditForm(true)}>
            Modifier
          </button>
        )}
      </div>

      {/* Bannière toggle */}
      <div style={s.section}>
        <CompanyBannerToggle
          userId={userId ?? ''}
          companyId={companyId}
          isActive={isActive}
          accentColor={detail.color}
        />
      </div>

      {/* Liste membres */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Membres</h3>
        <ul style={s.memberList}>
          {detail.members.map((member) => (
            <li key={member.userId} style={s.memberRow}>
              <span style={s.memberName}>
                {member.name}
                {member.isFounder && (
                  <span style={{ ...s.founderBadge, backgroundColor: detail.color }}>Fondateur</span>
                )}
              </span>
              {isFounder && !member.isFounder && member.userId !== userId && (
                <button
                  style={s.removeBtn}
                  onClick={() => handleRemove(member.userId)}
                  disabled={removingId === member.userId}
                  aria-label={`Exclure ${member.name}`}
                >
                  {removingId === member.userId ? '…' : 'Exclure'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Chat */}
      <div style={s.section}>
        <CompanyChatPanel
          companyId={companyId}
          members={detail.members}
          accentColor={detail.color}
        />
      </div>

      {/* Quitter */}
      {!isFounder && (
        <div style={s.section}>
          <button
            style={s.leaveBtn}
            onClick={handleLeave}
            disabled={leavePending}
          >
            {leavePending ? 'En cours…' : 'Quitter la Compagnie'}
          </button>
        </div>
      )}

      {/* Modale édition (fondateur) */}
      {showEditForm && isFounder && userId && (
        <CompanyCreateForm
          userId={userId}
          editCompany={{
            id: detail.id,
            name: detail.name,
            color: detail.color,
            imageUrl: detail.imageUrl,
            description: detail.description,
            isOfficial: detail.isOfficial,
            memberCount: detail.memberCount,
            isActive,
            isFounder: true,
          }}
          onSuccess={async () => {
            setShowEditForm(false)
            const { data } = await supabase.rpc('get_company', { p_company_id: companyId })
            if (data) setDetail(data as CompanyDetail)
          }}
          onCancel={() => setShowEditForm(false)}
        />
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex', flexDirection: 'column', gap: '0',
    background: 'var(--color-parchment, #F5E6D3)',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(193,154,107,0.25)',
  },
  state: {
    padding: '24px', fontSize: '16px',
    color: 'var(--color-ink-light, #8d745e)', textAlign: 'center',
  },
  header: {
    padding: '16px',
    borderBottom: '2px solid',
    position: 'relative',
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '22px', color: 'var(--color-ink, #4A3728)',
    padding: '0 8px 0 0', lineHeight: 1,
  },
  headerContent: {
    display: 'flex', alignItems: 'flex-start', gap: '14px', marginTop: '8px',
  },
  emblem: { width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 },
  emblemFallback: {
    width: '60px', height: '60px', borderRadius: '10px', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '26px', fontWeight: 700,
  },
  name: {
    margin: 0, fontFamily: 'var(--font-accent, sans-serif)',
    fontSize: '20px', color: 'var(--color-ink, #4A3728)',
  },
  description: {
    margin: '4px 0 0', fontSize: '15px',
    color: 'var(--color-ink-light, #7D5A3C)', lineHeight: 1.4,
  },
  count: { fontSize: '14px', color: 'var(--color-ink-light, #8d745e)', marginTop: '4px', display: 'block' },
  editBtn: {
    position: 'absolute', top: '16px', right: '16px',
    padding: '6px 14px', borderRadius: '6px',
    border: '1px solid rgba(193,154,107,0.5)',
    background: 'transparent', cursor: 'pointer',
    fontSize: '15px', color: 'var(--color-ink, #4A3728)',
  },
  section: { padding: '16px', borderBottom: '1px solid rgba(193,154,107,0.15)' },
  sectionTitle: {
    margin: '0 0 10px',
    fontFamily: 'var(--font-accent, sans-serif)',
    fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--color-ink, #4A3728)',
  },
  memberList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  memberRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
  memberName: { fontSize: '16px', color: 'var(--color-ink, #4A3728)', display: 'flex', alignItems: 'center', gap: '8px' },
  founderBadge: {
    fontSize: '12px', color: '#fff',
    borderRadius: '4px', padding: '2px 6px', fontWeight: 700,
  },
  removeBtn: {
    padding: '4px 10px', borderRadius: '6px',
    border: '1px solid rgba(192,57,43,0.4)',
    background: 'transparent', cursor: 'pointer',
    fontSize: '14px', color: '#c0392b',
  },
  leaveBtn: {
    padding: '10px 18px', borderRadius: '8px',
    border: '1px solid rgba(192,57,43,0.5)',
    background: 'transparent', cursor: 'pointer',
    fontSize: '16px', color: '#c0392b',
  },
}
