import { AppEvent } from '../types'
import { formatLocalDate } from './dateUtils'

export function expandRecurringEvents(
  events: AppEvent[],
  startDateStr: string,
  endDateStr: string
): AppEvent[] {
  const start = new Date(startDateStr + 'T00:00:00')
  const end = new Date(endDateStr + 'T23:59:59')

  const result: AppEvent[] = []

  // Create a map of events by ID for easy lookup of edited exceptions
  const eventMap = new Map<string, AppEvent>()
  events.forEach(e => eventMap.set(e.id, e))

  for (const event of events) {
    if (!event.date) continue

    // If this event is an exception instance (linked to an original), 
    // we only render it if it falls within the range. 
    // The main expansion loop below handles the virtual instances.
    if (event.originalEventId) {
      const d = new Date(event.date + 'T00:00:00')
      if (d >= start && d <= end) {
        result.push(event)
      }
      continue
    }

    if (!event.recurrence) {
      const d = new Date(event.date + 'T00:00:00')
      if (d >= start && d <= end) {
        result.push(event)
      }
      continue
    }

    // It's a recurring event base
    const rec = event.recurrence
    const baseDate = new Date(event.date + 'T00:00:00')
    const interval = Math.max(1, rec.interval || 1)
    
    // We start from the base date, but we only output if it's within [start, end]
    let current = new Date(baseDate)

    const maxOccurrences = 1000 // Safety limit
    let occurrenceCount = 0

    while (current <= end && occurrenceCount < maxOccurrences) {
      // Check limits
      if (rec.endType === 'count' && rec.count !== undefined && occurrenceCount >= rec.count) {
        break
      }
      if (rec.endType === 'until' && rec.endDate) {
        const untilDate = new Date(rec.endDate + 'T23:59:59')
        if (current > untilDate) break
      }

      const dateStr = formatLocalDate(current)
      
      // Match frequency logic
      let matchesFrequency = true
      if (rec.frequency === 'weekly' && rec.daysOfWeek && rec.daysOfWeek.length > 0) {
        matchesFrequency = rec.daysOfWeek.includes(current.getDay())
      }

      if (matchesFrequency && current >= baseDate) {
        // Only if it's in our requested view range
        if (current >= start && current <= end) {
          // Check if this date has an exception
          const exception = event.exceptions && event.exceptions[dateStr]
          if (!exception || !exception.deleted) {
            // If it's edited, we don't push the virtual one HERE,
            // because the edited standalone event will be pushed by the main loop (see event.originalEventId check above).
            if (!exception?.editedEventId) {
              result.push({
                ...event,
                id: `${event.id}_inst_${dateStr}`,
                date: dateStr,
                originalEventId: event.id,
                originalDate: dateStr
              })
            }
          }
        }
      }

      // Increment date based on frequency
      if (rec.frequency === 'daily') {
        current.setDate(current.getDate() + interval)
        occurrenceCount++
      } else if (rec.frequency === 'weekly') {
        // If we have specific days, we move day-by-day to check each one.
        // Но интервал применяется ко всей неделе.
        if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
          current.setDate(current.getDate() + 1)
          // If we crossed into a new week (assume Monday is 1, Sunday is 0)
          if (current.getDay() === 1) { // Crossed into Monday
            if (interval > 1) {
              current.setDate(current.getDate() + 7 * (interval - 1))
            }
          }
          if (matchesFrequency) occurrenceCount++
        } else {
          current.setDate(current.getDate() + 7 * interval)
          occurrenceCount++
        }
      } else if (rec.frequency === 'monthly') {
        current.setMonth(current.getMonth() + interval)
        occurrenceCount++
      } else if (rec.frequency === 'yearly') {
        current.setFullYear(current.getFullYear() + interval)
        occurrenceCount++
      } else {
        current.setDate(current.getDate() + 1)
        occurrenceCount++
      }
    }
  }

  return result
}
