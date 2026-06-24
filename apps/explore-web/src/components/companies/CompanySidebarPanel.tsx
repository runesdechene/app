import { useEffect, useState } from 'react'
import { useCompanyStore } from '../../stores/companyStore'
import { usePlayerStore } from '../../stores/playerStore'
import { CompaniesJoinCreateModal } from './CompaniesJoinCreateModal'
import { CompanyHallModal } from './CompanyHallModal'

/**
 * Onglet « Compagnie » de la sidebar desktop. Liste ta/tes Compagnie(s) ;
 * un clic ouvre le HALL en modale centrale 2 colonnes (CompanyHallModal).
 * Rejoindre/fonder ouvre la modale dédiée. Après un join, le Hall de la
 * compagnie rejointe s'ouvre automatiquement (focus posé par le store).
 */
export function CompanySidebarPanel() {
  const userId = usePlayerStore((s) => s.userId)
  const myCompanies = useCompanyStore((s) => s.myCompanies)
  const companiesLoaded = useCompanyStore((s) => s.companiesLoaded)
  const loadMine = useCompanyStore((s) => s.loadMine)
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const focusCompanyId = useCompanyStore((s) => s.focusCompanyId)
  const setFocusCompany = useCompanyStore((s) => s.setFocusCompany)

  const [showJoinCreate, setShowJoinCreate] = useState(false)
  const [hallCompanyId, setHallCompanyId] = useState<string | null>(null)

  useEffect(() => {
    if (userId) loadMine(userId)
  }, [userId, loadMine])

  // Après un join : ouvrir le Hall de la compagnie rejointe.
  useEffect(() => {
    if (focusCompanyId && myCompanies.some((c) => c.id === focusCompanyId)) {
      setHallCompanyId(focusCompanyId)
      setFocusCompany(null)
    }
  }, [focusCompanyId, myCompanies, setFocusCompany])

  if (!userId) return null

  return (
    <main className="activity-page-scroll">
      <h1 className="activity-page-title">Ma Compagnie</h1>

      {!companiesLoaded && myCompanies.length === 0 && (
        <p style={styles.state}>Chargement…</p>
      )}

      {companiesLoaded && myCompanies.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Tu ne fais partie d'aucune Compagnie.</p>
          <button style={styles.primaryBtn} onClick={() => setShowJoinCreate(true)}>
            Rejoindre ou fonder une Compagnie
          </button>
        </div>
      )}

      {myCompanies.length > 0 && (
        <>
          <ul style={styles.list}>
            {myCompanies.map((c) => (
              <li
                key={c.id}
                style={{
                  ...styles.card,
                  borderColor: c.id === activeCompanyId ? c.color : 'rgba(193,154,107,0.25)',
                }}
                onClick={() => setHallCompanyId(c.id)}
              >
                <div style={{ ...styles.colorBar, background: c.color }} />
                <div style={styles.emblemWrap}>
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" style={styles.emblem} />
                  ) : (
                    <div style={{ ...styles.emblemFallback, background: c.color }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={styles.info}>
                  <span style={styles.name}>{c.name}</span>
                  <span style={styles.meta}>
                    {c.memberCount} membre{c.memberCount !== 1 ? 's' : ''}
                    {c.isFounder && ' · Fondateur'}
                    {c.id === activeCompanyId && ' · Bannière active'}
                  </span>
                </div>
                <span style={styles.arrow} aria-hidden>›</span>
              </li>
            ))}
          </ul>

          {myCompanies.length < 2 && (
            <button style={styles.secondaryBtn} onClick={() => setShowJoinCreate(true)}>
              Rejoindre ou fonder une autre Compagnie
            </button>
          )}
        </>
      )}

      {showJoinCreate && (
        <CompaniesJoinCreateModal userId={userId} onClose={() => setShowJoinCreate(false)} />
      )}
      {hallCompanyId && (
        <CompanyHallModal companyId={hallCompanyId} onClose={() => setHallCompanyId(null)} />
      )}
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  state: { fontSize: '16px', fontStyle: 'italic', color: 'var(--color-ink-light, #8d745e)' },
  empty: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' },
  emptyText: { fontSize: '16px', color: 'var(--color-ink, #4A3728)', margin: 0 },
  primaryBtn: {
    padding: '12px', borderRadius: '10px', border: '1px solid rgba(193,154,107,0.6)',
    background: 'rgba(193,154,107,0.15)', fontSize: '16px', fontWeight: 600,
    color: 'var(--color-ink, #4A3728)', cursor: 'pointer',
  },
  secondaryBtn: {
    width: '100%', marginTop: '12px', padding: '10px', borderRadius: '8px',
    border: '1px solid rgba(193,154,107,0.5)', background: 'transparent',
    fontSize: '15px', color: 'var(--color-ink, #4A3728)', cursor: 'pointer',
  },
  list: { listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: '8px' },
  card: {
    display: 'flex', alignItems: 'center', gap: '12px',
    background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(193,154,107,0.25)',
    borderRadius: '10px', padding: '12px', position: 'relative', overflow: 'hidden', cursor: 'pointer',
  },
  colorBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px' },
  emblemWrap: { marginLeft: '4px', flexShrink: 0 },
  emblem: { width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' },
  emblemFallback: {
    width: '40px', height: '40px', borderRadius: '8px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', fontWeight: 700,
  },
  info: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  name: { fontSize: '16px', fontWeight: 600, color: 'var(--color-ink, #4A3728)' },
  meta: { fontSize: '14px', color: 'var(--color-ink-light, #8d745e)' },
  arrow: { flexShrink: 0, fontSize: '20px', color: 'var(--color-ink-light, #8d745e)' },
}
