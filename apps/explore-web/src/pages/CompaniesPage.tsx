import { useEffect, useState } from 'react'
import { useCompanyStore } from '../stores/companyStore'
import { usePlayerStore } from '../stores/playerStore'
import { CompanyDirectoryList } from '../components/companies/CompanyDirectoryList'
import { CompanyDetailPanel } from '../components/companies/CompanyDetailPanel'
import { CompanyCreateForm } from '../components/companies/CompanyCreateForm'
import './CompaniesPage.css'

export default function CompaniesPage() {
  const userId = usePlayerStore((s) => s.userId)
  const myCompanies = useCompanyStore((s) => s.myCompanies)
  const loading = useCompanyStore((s) => s.loading)
  const loadMine = useCompanyStore((s) => s.loadMine)
  const loadDirectory = useCompanyStore((s) => s.loadDirectory)
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    document.title = 'Runes de Chêne — Compagnies'
  }, [])

  useEffect(() => {
    if (userId) {
      loadMine(userId)
      loadDirectory()
    }
  }, [userId, loadMine, loadDirectory])

  function handleCreateSuccess() {
    setShowCreateForm(false)
    if (userId) loadMine(userId)
  }

  // Vue détail
  if (selectedId) {
    return (
      <main className="companies-page">
        <CompanyDetailPanel
          companyId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      </main>
    )
  }

  return (
    <main className="companies-page">
      {/* Mes Compagnies */}
      <section className="companies-section">
        <div className="companies-section-header">
          <h1 className="companies-page-title">Mes Compagnies</h1>
          {myCompanies.length < 2 && (
            <button
              className="companies-create-btn"
              onClick={() => setShowCreateForm(true)}
            >
              + Fonder
            </button>
          )}
        </div>

        {loading && <p className="companies-state">Chargement…</p>}

        {!loading && myCompanies.length === 0 && (
          <div className="companies-empty">
            <p>Vous ne faites partie d'aucune Compagnie.</p>
            <button
              className="companies-join-cta"
              onClick={() => setShowCreateForm(true)}
            >
              Fonder une Compagnie
            </button>
          </div>
        )}

        {myCompanies.length > 0 && (
          <ul className="companies-my-list">
            {myCompanies.map((company) => (
              <li
                key={company.id}
                className={`companies-my-card${company.id === activeCompanyId ? ' companies-my-card--active' : ''}`}
                onClick={() => setSelectedId(company.id)}
                style={{ borderColor: company.id === activeCompanyId ? company.color : undefined }}
              >
                <div className="companies-my-card-bar" style={{ backgroundColor: company.color }} />

                <div className="companies-my-card-emblem">
                  {company.imageUrl ? (
                    <img src={company.imageUrl} alt="" className="companies-emblem-img" />
                  ) : (
                    <div
                      className="companies-emblem-fallback"
                      style={{ backgroundColor: company.color }}
                    >
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="companies-my-card-info">
                  <span className="companies-my-card-name">{company.name}</span>
                  <span className="companies-my-card-meta">
                    {company.memberCount} membre{company.memberCount !== 1 ? 's' : ''}
                    {company.isFounder && ' · Fondateur'}
                    {company.id === activeCompanyId && ' · Bannière active'}
                  </span>
                </div>

                <span className="companies-my-card-arrow" aria-hidden>›</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Annuaire */}
      <section className="companies-section">
        <CompanyDirectoryList />
      </section>

      {/* Modale création */}
      {showCreateForm && userId && (
        <CompanyCreateForm
          userId={userId}
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}
    </main>
  )
}
