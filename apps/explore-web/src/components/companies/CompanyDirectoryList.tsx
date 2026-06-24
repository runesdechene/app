import { useState, useEffect } from 'react'
import { useCompanyStore } from '../../stores/companyStore'
import { usePlayerStore } from '../../stores/playerStore'

export function CompanyDirectoryList() {
  const userId = usePlayerStore((s) => s.userId)
  const directory = useCompanyStore((s) => s.directory)
  const myCompanies = useCompanyStore((s) => s.myCompanies)
  const loading = useCompanyStore((s) => s.loading)
  const loadDirectory = useCompanyStore((s) => s.loadDirectory)
  const join = useCompanyStore((s) => s.join)

  const [search, setSearch] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joiningId, setJoiningId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => loadDirectory(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search, loadDirectory])

  const myIds = new Set(myCompanies.map((c) => c.id))
  const atLimit = myCompanies.length >= 2

  async function handleJoin(companyId: string) {
    if (!userId) return
    setJoiningId(companyId)
    setJoinError(null)
    const result = await join(userId, companyId)
    setJoiningId(null)
    if ('error' in result) {
      const msg =
        result.error === 'already_member' ? 'Vous êtes déjà membre.'
        : result.error === 'too_many_companies' ? 'Vous faites déjà partie de 2 Compagnies.'
        : 'Erreur lors de la demande.'
      setJoinError(msg)
      setTimeout(() => setJoinError(null), 4000)
    }
  }

  return (
    <section style={s.section}>
      <h2 style={s.heading}>Annuaire des Compagnies</h2>

      <input
        style={s.searchInput}
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher une Compagnie…"
        aria-label="Rechercher"
      />

      {joinError && <p style={s.errorMsg}>{joinError}</p>}

      {loading && <p style={s.stateMsg}>Chargement…</p>}

      {!loading && directory.length === 0 && (
        <p style={s.stateMsg}>Aucune Compagnie trouvée.</p>
      )}

      <ul style={s.list}>
        {directory.map((company) => {
          const isMember = myIds.has(company.id)
          const canJoin = !isMember && !atLimit
          const isJoining = joiningId === company.id

          return (
            <li key={company.id} style={s.card}>
              {/* Accent couleur */}
              <div style={{ ...s.colorBar, backgroundColor: company.color }} />

              {/* Emblème ou initiale */}
              <div style={s.emblemWrapper}>
                {company.imageUrl ? (
                  <img src={company.imageUrl} alt="" style={s.emblem} />
                ) : (
                  <div style={{ ...s.emblemFallback, backgroundColor: company.color }}>
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Infos */}
              <div style={s.info}>
                <div style={s.nameRow}>
                  <span style={s.name}>{company.name}</span>
                  {company.isOfficial && (
                    <span style={s.officialBadge}>Officielle</span>
                  )}
                </div>
                {company.description && (
                  <p style={s.description}>{company.description}</p>
                )}
                <span style={s.count}>{company.memberCount} membre{company.memberCount !== 1 ? 's' : ''}</span>
              </div>

              {/* Action */}
              <div style={s.actionCol}>
                {isMember ? (
                  <span style={s.memberTag}>Membre</span>
                ) : (
                  <button
                    style={s.joinBtn}
                    onClick={() => handleJoin(company.id)}
                    disabled={!canJoin || isJoining}
                    title={atLimit ? 'Vous faites déjà partie de 2 Compagnies' : undefined}
                  >
                    {isJoining ? '…' : 'Rejoindre'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const s: Record<string, React.CSSProperties> = {
  section: { display: 'flex', flexDirection: 'column', gap: '12px' },
  heading: {
    margin: 0,
    fontFamily: 'var(--font-accent, sans-serif)',
    fontSize: '18px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--color-ink, #4A3728)',
  },
  searchInput: {
    padding: '10px 14px', fontSize: '16px',
    border: '1px solid rgba(193,154,107,0.5)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.5)',
    color: 'var(--color-ink, #4A3728)',
    outline: 'none',
  },
  stateMsg: {
    fontSize: '16px', color: 'var(--color-ink-light, #8d745e)',
    fontStyle: 'italic', margin: 0,
  },
  errorMsg: {
    fontSize: '15px', color: '#c0392b',
    background: 'rgba(192,57,43,0.08)',
    borderRadius: '6px', padding: '8px 12px', margin: 0,
  },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' },
  card: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: 'rgba(255,255,255,0.4)',
    border: '1px solid rgba(193,154,107,0.25)',
    borderRadius: '10px', padding: '12px', position: 'relative',
    overflow: 'hidden',
  },
  colorBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: '4px', borderRadius: '10px 0 0 10px',
  },
  emblemWrapper: { marginLeft: '4px', flexShrink: 0 },
  emblem: { width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' },
  emblemFallback: {
    width: '44px', height: '44px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: '20px', fontWeight: 700,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  name: {
    fontFamily: 'var(--font-accent, sans-serif)',
    fontSize: '17px', fontWeight: 600,
    color: 'var(--color-ink, #4A3728)',
  },
  officialBadge: {
    fontSize: '12px', fontWeight: 700,
    color: '#fff', background: '#7C6B4A',
    borderRadius: '4px', padding: '2px 6px',
    letterSpacing: '0.04em',
  },
  description: {
    margin: '4px 0 0', fontSize: '15px',
    color: 'var(--color-ink-light, #7D5A3C)',
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
  },
  count: {
    display: 'block', marginTop: '4px',
    fontSize: '14px', color: 'var(--color-ink-light, #8d745e)',
  },
  actionCol: { flexShrink: 0 },
  memberTag: {
    fontSize: '14px', color: 'var(--color-ink-light, #8d745e)',
    fontStyle: 'italic',
  },
  joinBtn: {
    padding: '8px 14px', borderRadius: '8px',
    border: '1px solid rgba(193,154,107,0.6)',
    background: 'transparent', cursor: 'pointer',
    fontSize: '15px', color: 'var(--color-ink, #4A3728)',
    fontWeight: 500,
    transition: 'background 0.15s',
  },
}
