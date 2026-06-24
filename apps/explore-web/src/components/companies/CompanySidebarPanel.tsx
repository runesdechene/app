import { useEffect, useState } from 'react'
import { useCompanyStore } from '../../stores/companyStore'
import { usePlayerStore } from '../../stores/playerStore'
import { CompanyDetailPanel } from './CompanyDetailPanel'
import { CompaniesJoinCreateModal } from './CompaniesJoinCreateModal'

/**
 * Onglet « Compagnie » de la sidebar desktop. Affiche directement le HALL de
 * ta Compagnie (focus/active/première). Sélecteur si tu en as deux. Si aucune,
 * un appel à rejoindre/fonder qui ouvre la modale. Les actions (rejoindre,
 * fonder) vivent dans la modale ; ici on consulte. Classement → SPEC 3.
 */
export function CompanySidebarPanel() {
  const userId = usePlayerStore((s) => s.userId)
  const myCompanies = useCompanyStore((s) => s.myCompanies)
  const companiesLoaded = useCompanyStore((s) => s.companiesLoaded)
  const loadMine = useCompanyStore((s) => s.loadMine)
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)
  const focusCompanyId = useCompanyStore((s) => s.focusCompanyId)
  const setFocusCompany = useCompanyStore((s) => s.setFocusCompany)

  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (userId) loadMine(userId)
  }, [userId, loadMine])

  if (!userId) return null

  // Chargement initial
  if (!companiesLoaded && myCompanies.length === 0) {
    return (
      <main className="activity-page-scroll">
        <h1 className="activity-page-title">Ma Compagnie</h1>
        <p style={styles.state}>Chargement…</p>
      </main>
    )
  }

  // Aucune Compagnie → appel à l'action (la modale fait le rejoindre/fonder)
  if (myCompanies.length === 0) {
    return (
      <main className="activity-page-scroll">
        <h1 className="activity-page-title">Ma Compagnie</h1>
        <div style={styles.empty}>
          <p style={styles.emptyText}>Tu ne fais partie d'aucune Compagnie.</p>
          <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
            Rejoindre ou fonder une Compagnie
          </button>
        </div>
        {showModal && <CompaniesJoinCreateModal userId={userId} onClose={() => setShowModal(false)} />}
      </main>
    )
  }

  // ≥1 Compagnie : hall de la compagnie focus / active / première
  const has = (id: string | null) => !!id && myCompanies.some((c) => c.id === id)
  const shownId = (has(focusCompanyId) && focusCompanyId)
    || (has(activeCompanyId) && activeCompanyId)
    || myCompanies[0].id

  return (
    <main className="activity-page-scroll">
      {myCompanies.length > 1 && (
        <div style={styles.switcher}>
          {myCompanies.map((c) => (
            <button
              key={c.id}
              onClick={() => setFocusCompany(c.id)}
              style={{
                ...styles.switchBtn,
                borderColor: c.id === shownId ? c.color : 'rgba(193,154,107,0.4)',
                fontWeight: c.id === shownId ? 700 : 500,
              }}
            >
              <span style={{ ...styles.switchDot, background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      )}

      <CompanyDetailPanel
        companyId={shownId}
        hideBack
        onClose={() => setFocusCompany(null)}
      />

      {myCompanies.length < 2 && (
        <button style={styles.secondaryBtn} onClick={() => setShowModal(true)}>
          Rejoindre ou fonder une autre Compagnie
        </button>
      )}

      {showModal && <CompaniesJoinCreateModal userId={userId} onClose={() => setShowModal(false)} />}
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
  switcher: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  switchBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '6px 12px', borderRadius: '999px', border: '1.5px solid',
    background: 'rgba(255,255,255,0.4)', cursor: 'pointer',
    fontSize: '14px', color: 'var(--color-ink, #4A3728)',
  },
  switchDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
}
