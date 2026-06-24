import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { CompanyDetailPanel } from './CompanyDetailPanel'
import { CompanyChatPanel } from './CompanyChatPanel'
import type { CompanyDetail } from '../../stores/companyStore'
import './CompanyHallModal.css'

interface Props {
  companyId: string
  onClose: () => void
}

/**
 * Hall de la Compagnie — modale centrale 2 colonnes (calquée sur ExpeditionModal).
 * Desktop : infos à gauche, chat (canal Compagnie) toujours à droite.
 * Mobile : onglets Infos / Chat.
 * Le chat est le même canal que dans l'onglet Tchat (chat_messages / channel=companyId).
 */
export function CompanyHallModal({ companyId, onClose }: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [tab, setTab] = useState<'info' | 'chat'>('info')
  const [detail, setDetail] = useState<CompanyDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_company', { p_company_id: companyId }).then(({ data }) => {
      if (cancelled) return
      const d = data as CompanyDetail | { error: string } | null
      if (d && !('error' in d)) setDetail(d)
    })
    return () => { cancelled = true }
  }, [companyId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const showInfo = !isMobile || tab === 'info'
  const showChat = !isMobile || tab === 'chat'

  return (
    <div className="company-hall-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        className="company-hall-modal"
        style={detail ? { borderTopColor: detail.color } : undefined}
      >
        <button className="company-hall-close" onClick={onClose} aria-label="Fermer">×</button>

        {isMobile && (
          <div className="company-hall-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'info'}
              className={`company-hall-tab${tab === 'info' ? ' is-active' : ''}`}
              onClick={() => setTab('info')}
            >Infos</button>
            <button
              role="tab"
              aria-selected={tab === 'chat'}
              className={`company-hall-tab${tab === 'chat' ? ' is-active' : ''}`}
              onClick={() => setTab('chat')}
            >Chat</button>
          </div>
        )}

        <div className="company-hall-body">
          {showInfo && (
            <div className="company-hall-info">
              <CompanyDetailPanel companyId={companyId} hideBack hideChat onClose={onClose} />
            </div>
          )}
          {showChat && (
            <div className="company-hall-chat">
              {detail ? (
                <CompanyChatPanel companyId={companyId} members={detail.members} accentColor={detail.color} />
              ) : (
                <div className="company-hall-chat-loading">Chargement du canal…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
