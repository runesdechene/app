import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMissionsStore } from '../../stores/missionsStore'
import { formatDeadlineCountdown } from '../../lib/deadlineCountdown'

interface ActiveMission {
  slug: string
  title: string
  emblem: string | null
  ends_at: string | null
}

export function MissionEntryCard() {
  const [m, setM] = useState<ActiveMission | null>(null)
  const requestOpen = useMissionsStore((s) => s.requestOpen)

  useEffect(() => {
    supabase
      .from('missions')
      .select('slug, title, emblem, ends_at')
      .eq('status', 'published')
      .order('starts_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setM((data?.[0] as ActiveMission) ?? null))
  }, [])

  if (!m) return null

  const countdown = formatDeadlineCountdown(m.ends_at)

  return (
    <button className="mission-entry-card" onClick={() => requestOpen(m.slug)}>
      <span className="mec-emblem">{m.emblem ?? '🎯'}</span>
      <span className="mec-title">{m.title}</span>
      {countdown && <span className="mec-deadline">⏳ {countdown}</span>}
      <span className="mec-go">→</span>
    </button>
  )
}
