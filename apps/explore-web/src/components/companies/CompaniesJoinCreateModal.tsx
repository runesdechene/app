import { useEffect, useState } from 'react'
import { useCompanyStore } from '../../stores/companyStore'
import { CompanyDirectoryList } from './CompanyDirectoryList'
import { CompanyCreateForm } from './CompanyCreateForm'

interface Props {
  userId: string
  onClose: () => void
}

/**
 * Modale desktop « Rejoindre / Fonder une Compagnie ».
 * Le panneau sidebar sert à VOIR sa compagnie ; les actions (rejoindre via
 * l'annuaire, fonder) passent par cette modale au-dessus de la carte.
 * CompanyCreateForm est lui-même un overlay → il se superpose à cette modale.
 */
export function CompaniesJoinCreateModal({ userId, onClose }: Props) {
  const loadMine = useCompanyStore((s) => s.loadMine)
  const myCompanies = useCompanyStore((s) => s.myCompanies)
  const [showCreate, setShowCreate] = useState(false)

  // Fermer sur Échap
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleCreateSuccess() {
    setShowCreate(false)
    loadMine(userId)
    onClose()
  }

  const atLimit = myCompanies.length >= 2

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Rejoindre ou fonder une Compagnie</h2>
          <button style={styles.close} onClick={onClose} aria-label="Fermer">×</button>
        </div>

        <div style={styles.body}>
          <CompanyDirectoryList />
        </div>

        <div style={styles.footer}>
          <button
            style={{ ...styles.foundBtn, opacity: atLimit ? 0.5 : 1, cursor: atLimit ? 'not-allowed' : 'pointer' }}
            onClick={() => !atLimit && setShowCreate(true)}
            disabled={atLimit}
            title={atLimit ? 'Vous faites déjà partie de 2 Compagnies' : undefined}
          >
            + Fonder une Compagnie
          </button>
        </div>
      </div>

      {showCreate && (
        <CompanyCreateForm
          userId={userId}
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(40,28,18,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: 'var(--color-parchment, #F4ECD9)',
    border: '1px solid rgba(193,154,107,0.6)',
    borderRadius: '14px',
    width: 'min(560px, 100%)', maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid rgba(193,154,107,0.3)',
  },
  title: {
    margin: 0, fontFamily: 'var(--font-accent, serif)',
    fontSize: '20px', color: 'var(--color-ink, #4A3728)',
  },
  close: {
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '28px', lineHeight: 1, color: 'var(--color-ink-light, #8d745e)',
    padding: '0 4px',
  },
  body: { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  footer: {
    padding: '16px 20px', borderTop: '1px solid rgba(193,154,107,0.3)',
  },
  foundBtn: {
    width: '100%', padding: '12px', borderRadius: '10px',
    border: '1px solid rgba(193,154,107,0.6)',
    background: 'rgba(193,154,107,0.15)',
    fontSize: '16px', fontWeight: 600, color: 'var(--color-ink, #4A3728)',
  },
}
