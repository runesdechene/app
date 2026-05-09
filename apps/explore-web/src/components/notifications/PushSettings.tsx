import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import {
  pushSupportStatus,
  subscribeUser,
  unsubscribeUser,
} from '../../lib/pushNotifications'
import './PushSettings.css'

export function PushSettings() {
  const userId = usePlayerStore((s) => s.userId)
  const [important, setImportant] = useState(true)
  const [recap, setRecap] = useState(true)
  // hasSub = "il existe une sub navigateur active" (pas juste 'permission hasSub'
  // qui reste true même après unsubscribe). C'est cette sub qui détermine si
  // l'utilisateur reçoit réellement les push.
  const [hasSub, setHasSub] = useState(false)
  const supported = pushSupportStatus() === 'native'
  const [loading, setLoading] = useState(true)

  // Lit l'état actuel : prefs DB + présence de la sub navigateur
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const [prefsRes, subRes] = await Promise.all([
        supabase
          .from('users')
          .select('push_important_enabled, push_recap_enabled')
          .eq('id', userId)
          .single(),
        (async () => {
          if (!('serviceWorker' in navigator)) return null
          const reg = await navigator.serviceWorker.ready
          return reg.pushManager.getSubscription()
        })(),
      ])
      if (cancelled) return
      if (prefsRes.data) {
        setImportant(Boolean(prefsRes.data.push_important_enabled))
        setRecap(Boolean(prefsRes.data.push_recap_enabled))
      }
      setHasSub(Boolean(subRes))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId])

  async function persist(field: 'push_important_enabled' | 'push_recap_enabled', value: boolean) {
    if (!userId) return
    await supabase.from('users').update({ [field]: value }).eq('id', userId)
  }

  async function toggleMaster() {
    if (!userId) return
    if (hasSub) {
      await unsubscribeUser()
      setHasSub(false)
    } else {
      const sub = await subscribeUser(userId)
      setHasSub(Boolean(sub))
    }
  }

  if (!supported) {
    return (
      <div className="push-settings push-settings--unsupported">
        <h3>Notifications</h3>
        <p>Ton navigateur ne supporte pas les notifications push.</p>
      </div>
    )
  }

  if (loading) return <div className="push-settings"><h3>Notifications</h3></div>

  return (
    <div className="push-settings">
      <h3>Notifications</h3>

      <div className="push-settings-row">
        <label className="push-settings-label">
          <input
            type="checkbox"
            checked={hasSub}
            onChange={toggleMaster}
          />
          <span>Recevoir les notifications RdC</span>
        </label>
      </div>

      <div className={`push-settings-cats${hasSub ? '' : ' is-disabled'}`}>
        <label className="push-settings-cat">
          <input
            type="checkbox"
            checked={important}
            disabled={!hasSub}
            onChange={async (e) => {
              setImportant(e.target.checked)
              await persist('push_important_enabled', e.target.checked)
            }}
          />
          <div>
            <strong>Importantes</strong>
            <small>Énigme du jour, messages d'expédition, lieu contesté.</small>
          </div>
        </label>

        <label className="push-settings-cat">
          <input
            type="checkbox"
            checked={recap}
            disabled={!hasSub}
            onChange={async (e) => {
              setRecap(e.target.checked)
              await persist('push_recap_enabled', e.target.checked)
            }}
          />
          <div>
            <strong>Récap & moments</strong>
            <small>Avant un palier de niveau, nouveaux lieux de la semaine.</small>
          </div>
        </label>
      </div>
    </div>
  )
}
