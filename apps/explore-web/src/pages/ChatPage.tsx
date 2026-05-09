import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useChat } from '../hooks/useChat'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { MobileSelectionModals } from '../components/navigation/MobileSelectionModals'
import { ChatPanel } from '../components/chat/ChatPanel'
import './ChatPage.css'

export default function ChatPage() {
  const { user } = useAuth()
  // usePlayer set playerStore.userId — pré-requis pour que useChat fetch
  // (cas reload direct sur /chat sans passer par /accueil).
  usePlayer()
  // Charge les messages + subscribe Realtime
  useChat()

  useEffect(() => {
    document.title = 'Runes de Chêne — Chat'
  }, [])

  if (!user) return null

  return (
    <div className="chat-page">
      <MobileTopBar />
      <main className="chat-page-content">
        <ChatPanel />
      </main>
      <BottomTabbar />
      <MobileSelectionModals />
    </div>
  )
}
