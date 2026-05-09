import { create } from 'zustand'
import { useCallback, useEffect } from 'react'
import { PushPermissionModal } from '../components/notifications/PushPermissionModal'
import { IOSInstallGuideModal } from '../components/notifications/IOSInstallGuideModal'
import { pushSupportStatus, subscribeUser, syncSubscription, isUserDisabled } from '../lib/pushNotifications'
import { usePlayerStore } from '../stores/playerStore'

type ModalKind = 'none' | 'permission' | 'ios'

interface State {
  kind: ModalKind
  title: string
  body: string
  open: (kind: ModalKind, title?: string, body?: string) => void
  close: () => void
}

const usePushPromptStore = create<State>((set) => ({
  kind: 'none',
  title: '',
  body: '',
  open: (kind, title = '', body = '') => set({ kind, title, body }),
  close: () => set({ kind: 'none', title: '', body: '' }),
}))

const DENIED_KEY      = 'push_denied_at'
const IOS_DISMISS_KEY = 'ios_install_prompt_dismissed_at'
// 14 jours en ms
const IOS_DISMISS_COOLDOWN_MS = 14 * 24 * 3600 * 1000

interface EnsureArgs {
  reason: string
  title: string
  body: string
}

// Hook réutilisable. Appelle ensurePush({...}) au moment "well-timed"
// (submit énigme, création d'expé, etc.).
export function useEnsurePushPermission(): (args: EnsureArgs) => void {
  const userId = usePlayerStore((s) => s.userId)
  const open = usePushPromptStore((s) => s.open)

  return useCallback(
    (args: EnsureArgs) => {
      if (!userId) return
      // Respecte l'intention explicite de désactivation
      if (isUserDisabled()) return
      const status = pushSupportStatus()

      if (status === 'unsupported') return

      if (status === 'ios-needs-install') {
        const dismissedAt = Number(localStorage.getItem(IOS_DISMISS_KEY) || 0)
        if (Date.now() - dismissedAt < IOS_DISMISS_COOLDOWN_MS) return
        open('ios')
        return
      }

      // status === 'native'
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'granted') {
        // déjà autorisé : on s'assure d'être bien subscribed (no-op si déjà OK)
        void subscribeUser(userId)
        return
      }
      if (Notification.permission === 'denied') return
      if (localStorage.getItem(DENIED_KEY)) return

      open('permission', args.title, args.body)
    },
    [userId, open],
  )
}

// Composant à monter UNE SEULE fois au top de l'app.
export function PushPromptHost() {
  const { kind, title, body, close } = usePushPromptStore()
  const userId = usePlayerStore((s) => s.userId)

  const onAccept = useCallback(async () => {
    close()
    if (!userId) return
    try {
      const sub = await subscribeUser(userId)
      if (!sub) {
        localStorage.setItem(DENIED_KEY, String(Date.now()))
      }
    } catch {
      localStorage.setItem(DENIED_KEY, String(Date.now()))
    }
  }, [userId, close])

  const onDismiss = useCallback(() => {
    localStorage.setItem(DENIED_KEY, String(Date.now()))
    close()
  }, [close])

  const onIOSLater = useCallback(() => {
    localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()))
    close()
  }, [close])

  const onIOSUnderstood = useCallback(() => {
    localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()))
    close()
  }, [close])

  return (
    <>
      <PushPermissionModal
        open={kind === 'permission'}
        title={title}
        body={body}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
      <IOSInstallGuideModal
        open={kind === 'ios'}
        onLater={onIOSLater}
        onUnderstood={onIOSUnderstood}
      />
    </>
  )
}

// Sync auto au login : aligne la sub locale ↔ DB.
// À monter UNE SEULE fois également (pas de UI).
export function PushSubscriptionSync() {
  const userId = usePlayerStore((s) => s.userId)
  useEffect(() => {
    if (!userId) return
    void syncSubscription(userId)
  }, [userId])
  return null
}

// Prompt doux au boot : si l'user n'a pas encore décidé ET pas de sub
// active, on propose la modale après un délai de 6 secondes (le temps
// que la carte charge et que l'user voit où il est). Cooldown de 7 jours
// si "Plus tard" a été cliqué — pas de harcèlement.
export function PushAutoPrompt() {
  const userId = usePlayerStore((s) => s.userId)
  const ensurePush = useEnsurePushPermission()

  useEffect(() => {
    if (!userId) return
    const timer = setTimeout(() => {
      // ensurePush gère déjà les checks : permission === 'denied' → noop,
      // already subscribed → noop, ios needs install → modale install.
      ensurePush({
        reason: 'auto_boot',
        title: 'Reste connecté à Runes de Chêne',
        body:  'Active les notifications pour suivre tes énigmes du jour, tes lieux et tes expéditions.',
      })
    }, 6000)
    return () => clearTimeout(timer)
  }, [userId, ensurePush])

  return null
}
