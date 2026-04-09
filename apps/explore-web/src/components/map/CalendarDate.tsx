import { useState } from 'react'
import { useCalendarRef } from '../../hooks/useCalendarRef'
import { formatFullDate, CALENDAR_LABELS, CalendarRef } from '../../lib/calendarUtils'
import './CalendarDate.css'

const REFS: CalendarRef[] = ['gregorian', 'auc', 'constantinople', 'imperial', 'coligny']

export function CalendarDate() {
  const { calendarRef, setCalendarRef } = useCalendarRef()
  const [open, setOpen] = useState(false)
  const now = new Date()

  return (
    <div className="calendar-date-wrapper">
      <button
        className="calendar-date"
        onClick={() => setOpen(!open)}
        title={CALENDAR_LABELS[calendarRef]}
      >
        {formatFullDate(now, calendarRef)}
      </button>
      {open && (
        <>
          <div className="calendar-date-backdrop" onClick={() => setOpen(false)} />
          <div className="calendar-date-dropdown">
            {REFS.map(ref => (
              <button
                key={ref}
                className={`calendar-date-option${calendarRef === ref ? ' active' : ''}`}
                onClick={() => { setCalendarRef(ref); setOpen(false) }}
              >
                {calendarRef === ref && <span className="calendar-date-check">✓</span>}
                {CALENDAR_LABELS[ref]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
