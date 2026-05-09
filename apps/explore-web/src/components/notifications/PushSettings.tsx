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
  const [granted, setGranted] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const supported = pushSupportStatus() === 'native'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('users')
        .select('push_important_enabled, push_recap_enabled')
        .eq('id', userId)
        .single()
      if (cancelled || !data) return
      setImportant(Boolean(data.push_important_enabled))
      setRecap(Boolean(data.push_recap_enabled))
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
    if (granted) {
      await unsubscribeUser()
      setGranted(false)
    } else {
      const sub = await subscribeUser(userId)
      setGranted(Boolean(sub))
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
            checked={granted}
            onChange={toggleMaster}
          />
          <span>Recevoir les notifications RdC</span>
        </label>
      </div>

      <div className={`push-settings-cats${granted ? '' : ' is-disabled'}`}>
        <label className="push-settings-cat">
          <input
            type="checkbox"
            checked={important}
            disabled={!granted}
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
            disabled={!granted}
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
