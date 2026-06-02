import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'

interface CQ {
  id: string
  wording: string
  icon: string
  target: number
  current: number
  myContribution: number
}

export function CommunityQuestCard() {
  const userId = usePlayerStore((s) => s.userId)
  const [cq, setCq] = useState<CQ | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .rpc('get_active_community_quest', { p_user_id: userId })
      .then(({ data }) => setCq(data as CQ | null))
  }, [userId])

  if (!cq) return null

  const pct = Math.min(100, Math.round((cq.current / cq.target) * 100))

  return (
    <div className="community-quest-card">
      <div className="cqc-head">{cq.icon} {cq.wording}</div>
      <div className="cqc-bar"><div className="cqc-bar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="cqc-meta">{cq.current}/{cq.target} · ta contribution : {cq.myContribution}</div>
    </div>
  )
}
