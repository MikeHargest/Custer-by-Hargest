import { calendar_v3 } from 'googleapis'
import { v4 as uuidv4 } from 'uuid'
import { AppEvent } from '../renderer/src/types'

/**
 * Converts a Google Calendar Event to a Cluster AppEvent.
 */
export function googleToClusterEvent(
  gEvent: calendar_v3.Schema$Event,
  projectId: string
): AppEvent {
  // If no summary, label it as Untitled
  let title = gEvent.summary || 'Untitled Event'
  
  // Try to find if it was originally a task or note via extended properties
  // We will store projectId in extendedProperties, but AppEvent itself doesn't strictly have a root 'projectId' 
  // parameter in types.ts (it's implicitly known in context).
  let clusterType = 'event'

  if (gEvent.extendedProperties?.private) {
    if (gEvent.extendedProperties.private.clusterType) {
      clusterType = gEvent.extendedProperties.private.clusterType
    }
  }

  let date = ''
  let time = ''
  let recurrence: any = undefined
  let originalEventId: string | undefined = undefined
  
  if (gEvent.start?.dateTime) {
    const d = new Date(gEvent.start.dateTime)
    date = d.toISOString().split('T')[0]
    time = d.toTimeString().substring(0, 5) // HH:mm
  } else if (gEvent.start?.date) {
    date = gEvent.start.date
  }

  // Handling recurrence
  if (gEvent.recurrence && gEvent.recurrence.length > 0) {
     // A simple parser for RRULE
     const rruleLine = gEvent.recurrence.find((r: string) => r.startsWith('RRULE:'))
     if (rruleLine) {
        recurrence = parseRRule(rruleLine)
     }
  }

  // Handle exceptions (A modified instance of a repeated event)
  if (gEvent.recurringEventId) {
     originalEventId = gEvent.recurringEventId // We will need to stitch this to the base event later
  }

  return {
    id: gEvent.id || uuidv4(),
    title,
    date: date || undefined,
    time: time || undefined,
    location: gEvent.location || undefined,
    
    // Sync Metadata
    externalId: gEvent.id || undefined,
    etag: gEvent.etag || undefined,
    syncStatus: 'synced' as any,
    updatedAt: gEvent.updated ? new Date(gEvent.updated).getTime() : Date.now(),
    
    recurrence,
    originalEventId
  }
}

/**
 * Converts a Cluster AppEvent to a Google Calendar Event payload.
 */
export function clusterToGoogleEvent(
  event: AppEvent,
  projectId?: string
): calendar_v3.Schema$Event {
  const gEvent: calendar_v3.Schema$Event = {
    summary: event.title,
    location: event.location || undefined,
    extendedProperties: {
      private: {
        clusterType: 'event',
        ...(projectId ? { projectId } : {})
      }
    }
  }

  // Timings
  if (event.date) {
    if (event.time) {
      // Need precise timezone string, using current system timezone assuming ISO
      const startDateTime = new Date(`${event.date}T${event.time}:00`).toISOString()
      gEvent.start = { dateTime: startDateTime }
      
      // Default 1 hour duration since AppEvent has only `time`
      const d = new Date(`${event.date}T${event.time}:00`)
      d.setHours(d.getHours() + 1)
      gEvent.end = { dateTime: d.toISOString() }
    } else {
      // Full day event
      gEvent.start = { date: event.date }
      // Google requires end date for full day events to be the next day (exclusive)
      const d = new Date(event.date)
      d.setDate(d.getDate() + 1)
      gEvent.end = { date: d.toISOString().split('T')[0] }
    }
  } else {
    // If no date is set in Cluster, we shouldn't really sync it to Calendar.
    // Or we set a fallback date today. For now, skip or fallback explicitly.
    const today = new Date().toISOString().split('T')[0]
    gEvent.start = { date: today }
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    gEvent.end = { date: tomorrow.toISOString().split('T')[0] }
  }

  // Recurrency
  if (event.recurrence) {
    gEvent.recurrence = [buildRRule(event.recurrence)]
  }

  return gEvent
}

// ==== Helpers ====

function buildRRule(rec: any): string {
  let rule = `RRULE:FREQ=${rec.frequency.toUpperCase()}`
  if (rec.interval && rec.interval > 1) {
    rule += `;INTERVAL=${rec.interval}`
  }
  if (rec.frequency === 'weekly' && rec.daysOfWeek && rec.daysOfWeek.length > 0) {
    const map = ['SU','MO','TU','WE','TH','FR','SA']
    const days = rec.daysOfWeek.map((d: number) => map[d]).join(',')
    rule += `;BYDAY=${days}`
  }
  if (rec.endType === 'count' && rec.count) {
    rule += `;COUNT=${rec.count}`
  } else if (rec.endType === 'until' && rec.endDate) {
    // UNTIL must be an RFC5545 date-time, e.g. 20261231T235959Z
    const d = new Date(rec.endDate + 'T23:59:59Z')
    const unt = d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    rule += `;UNTIL=${unt}`
  }
  return rule
}

function parseRRule(rruleStr: string): any {
  // strip 'RRULE:'
  const paramsStr = rruleStr.replace('RRULE:', '')
  const parts = paramsStr.split(';')
  const rec: any = {
     frequency: 'daily',
     interval: 1,
     endType: 'never'
  }

  for (const part of parts) {
    const [key, val] = part.split('=')
    if (key === 'FREQ') rec.frequency = val.toLowerCase()
    if (key === 'INTERVAL') rec.interval = parseInt(val, 10)
    if (key === 'COUNT') {
       rec.endType = 'count'
       rec.count = parseInt(val, 10)
    }
    if (key === 'UNTIL') {
       rec.endType = 'until'
       // Crude conversion back to YYYY-MM-DD
       if (val.length >= 8) {
          rec.endDate = `${val.substring(0,4)}-${val.substring(4,6)}-${val.substring(6,8)}`
       }
    }
    if (key === 'BYDAY') {
       const map:any = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 }
       rec.daysOfWeek = val.split(',').map((d: string) => map[d]).filter((d: number) => d !== undefined)
    }
  }
  return rec
}
