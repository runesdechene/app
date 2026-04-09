import { useState, useCallback } from 'react'
import type { CalendarRef } from '../lib/calendarUtils'

const STORAGE_KEY = 'calendar-ref'

function getStoredRef(): CalendarRef {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'auc' || stored === 'constantinople') return stored
  return 'gregorian'
}

export function useCalendarRef() {
  const [calendarRef, setCalendarRefState] = useState<CalendarRef>(getStoredRef)

  const setCalendarRef = useCallback((ref: CalendarRef) => {
    localStorage.setItem(STORAGE_KEY, ref)
    setCalendarRefState(ref)
  }, [])

  return { calendarRef, setCalendarRef }
}
