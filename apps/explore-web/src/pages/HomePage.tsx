import { useEffect } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { HomeFeed } from '../components/home/HomeFeed'
import type { MobileLayoutContext } from './MobileLayout'

/**
 * Page /accueil — wrapper mobile autour de HomeFeed (source unique partagée
 * avec la leftbar desktop). MobileTopBar / BottomTabbar / hooks d'init /
 * modales lieu&joueur sont dans MobileLayout parent.
 */
export default function HomePage() {
  const navigate = useNavigate()
  const { openFactionModal } = useOutletContext<MobileLayoutContext>()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  return (
    <HomeFeed
      openFactionModal={openFactionModal}
      showActivity
      onSeeMoreActivity={() => navigate('/activite')}
    />
  )
}
