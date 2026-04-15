import { useState, useCallback } from 'react'
import type { CalendarRef } from '../lib/calendarUtils'
import { safeStorage } from '../lib/safeStorage'

const STORAGE_KEY = 'calendar-ref'

function getStoredRef(): CalendarRef {
  const stored = safeStorage.get(STORAGE_KEY)
  if (stored === 'auc' || stored === 'constantinople') return stored
  return 'gregorian'
}

export function useCalendarRef() {
  const [calendarRef, setCalendarRefState] = useState<CalendarRef>(getStoredRef)

  const setCalendarRef = useCallback((ref: CalendarRef) => {
    safeStorage.set(STORAGE_KEY, ref)
    setCalendarRefState(ref)
  }, [])

  return { calendarRef, setCalendarRef }
}
