import { useEffect } from 'react'
import { ChatPanel } from '../components/chat/ChatPanel'
import './ChatPage.css'

/**
 * Page /chat — wrapper plein écran de ChatPanel sur mobile.
 * MobileTopBar / BottomTabbar / hooks d'init sont dans MobileLayout parent.
 */
export default function ChatPage() {
  useEffect(() => {
    document.title = 'Runes de Chêne — Chat'
  }, [])

  return (
    <main className="chat-page-content">
      <ChatPanel />
    </main>
  )
}
