import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './WishlistButton.css'

interface WishlistButtonProps {
  placeId: string
  isWishlisted: boolean
}

export function WishlistButton({ placeId, isWishlisted }: WishlistButtonProps) {
  const userId = usePlayerStore(s => s.userId)
  const [wishlisted, setWishlisted] = useState(isWishlisted)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    if (!userId || loading) return
    setLoading(true)

    const { data, error } = await supabase.rpc('toggle_wishlist', {
      p_user_id: userId,
      p_place_id: placeId,
    })

    if (!error && data) {
      setWishlisted(data.wishlisted ?? !wishlisted)
    }

    setLoading(false)
  }

  if (!userId) return null

  return (
    <button
      className={`wishlist-btn${wishlisted ? ' wishlisted' : ''}`}
      onClick={handleToggle}
      disabled={loading}
      title={wishlisted ? 'Retirer de la wishlist' : 'Je veux y aller'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    </button>
  )
}
