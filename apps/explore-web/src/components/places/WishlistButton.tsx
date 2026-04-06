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
      className="wishlist-btn"
      onClick={handleToggle}
      disabled={loading}
      title={wishlisted ? 'Retirer de la wishlist' : 'Je veux y aller'}
    >
      {wishlisted ? '\uD83D\uDCD6' : '\uD83D\uDD16'}
    </button>
  )
}
