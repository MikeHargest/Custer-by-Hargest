import { google, calendar_v3 } from 'googleapis'
import { AppEvent } from '../renderer/src/types'
import { googleToClusterEvent, clusterToGoogleEvent } from './googleMapper'
import StoreModule from 'electron-store'
import { safeStorage } from 'electron'
import { OAuth2Client } from 'google-auth-library'

const Store = typeof StoreModule === 'function' ? StoreModule : (StoreModule as any).default
const store = new Store()

const GOOGLE_CLIENT_ID = '502882586830-q6ijqftc1pjr8erajlmsbm28b4oomj2n.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = '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'
const REDIRECT_URI = 'http://localhost:8081/oauth2callback'

/**
 * SyncManager coordinates bidirectional syncing with Google Calendar.
 */
export class GoogleSyncManager {
  private calendar: calendar_v3.Calendar
  private isAuthorized: boolean = false
  private oauth2Client: OAuth2Client

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    )
    this.calendar = google.calendar('v3')
    // Do NOT call initializeAuth here — safeStorage is not ready before app.whenReady()
  }

  /**
   * Lazily initialize auth from stored tokens.
   * Must only be called after app is ready (safeStorage available).
   */
  initializeAuth(): boolean {
    const saved = store.get('google-auth-tokens') as string | undefined
    if (!saved) {
      this.isAuthorized = false
      return false
    }

    try {
      let tokens: any

      // Try to decrypt with safeStorage first
      if (safeStorage.isEncryptionAvailable()) {
        try {
          const decrypted = safeStorage.decryptString(Buffer.from(saved, 'base64'))
          tokens = JSON.parse(decrypted)
        } catch (decryptErr) {
          // Tokens might have been stored as plain JSON (before encryption was available)
          // or the format changed — try parsing as plain JSON
          console.warn('[SyncManager] Failed to decrypt tokens, trying plain JSON...', decryptErr)
          try {
            tokens = JSON.parse(saved)
          } catch {
            // Neither encrypted nor valid JSON — tokens are corrupted
            console.error('[SyncManager] Stored tokens are corrupted. Clearing them.')
            store.delete('google-auth-tokens')
            this.isAuthorized = false
            return false
          }
        }
      } else {
        tokens = JSON.parse(saved)
      }

      this.oauth2Client.setCredentials(tokens)
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })
      this.isAuthorized = true
      console.log('[SyncManager] Auth initialized successfully')
      return true
    } catch (e) {
      console.error('[SyncManager] Failed to init auth tokens:', e)
      this.isAuthorized = false
      return false
    }
  }

  /**
   * Set oauth2 credentials directly (e.g. after fresh login in index.ts)
   */
  setCredentials(tokens: any): void {
    this.oauth2Client.setCredentials(tokens)
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })
    this.isAuthorized = true
    console.log('[SyncManager] Credentials set directly')
  }

  /**
   * Performs a two-way sync for a specific project.
   * "Last Write Wins" resolution for conflicts.
   */
  async syncProject(projectId: string, projectName: string, localEvents: AppEvent[]): Promise<AppEvent[]> {
    if (!this.isAuthorized) {
       this.initializeAuth()
       if (!this.isAuthorized) return localEvents // Skip sync if still unauthorized
    }

    try {
      console.log(`[Sync] Attempting to match project "${projectName}" with Google Calendars...`)
      let calendars: calendar_v3.Schema$CalendarListEntry[] = []
      try {
        const calendarListRes = await this.calendar.calendarList.list()
        calendars = calendarListRes.data.items || []
        console.log(`[Sync] Found ${calendars.length} calendars:`)
        calendars.forEach(c => {
          console.log(`  - Summary: "${c.summary}", ID: ${c.id}`)
        })
      } catch (listErr) {
        console.error(`[Sync] Failed to fetch calendar list from Google:`, listErr)
        return localEvents
      }
      
      const matchingCalendar = calendars.find(c => {
        const calName = (c.summary || '').toLowerCase().trim()
        const projName = projectName.toLowerCase().trim()
        return calName === projName
      })

      if (!matchingCalendar) {
        console.log(`[Sync] No matching calendar found for project "${projectName}". Skipped.`)
        return localEvents
      }

      const calendarId = matchingCalendar.id!
      console.log(`[Sync] Match found! Project "${projectName}" -> Calendar "${matchingCalendar.summary}" (${calendarId})`)

      // 0. MARK UNTRACKED LOCAL EVENTS AS PENDING_PUSH
      // Events created before sync was added don't have syncStatus — mark them for upload
      for (const e of localEvents) {
        if (!e.syncStatus && !e.externalId) {
          e.syncStatus = 'pending_push' as any
          e.updatedAt = e.updatedAt || Date.now()
          console.log(`[Sync] Marking untracked event for push: ${e.title}`)
        }
      }

      // 1. PUSH PENDING DELETES
      const pendingDeletes = localEvents.filter(e => e.syncStatus === 'pending_delete' && e.externalId)
      for (const e of pendingDeletes) {
         try {
            await this.calendar.events.delete({
              calendarId: calendarId,
              eventId: e.externalId!
            })
            console.log(`[Sync] Deleted from Google: ${e.title}`)
         } catch (err: any) {
            if (err.code !== 404 && err.code !== 410) console.error('Delete error', err)
         }
      }

      // Filter out deleted from local pool now
      let currentEvents = localEvents.filter(e => e.syncStatus !== 'pending_delete')

      // 2. PUSH PENDING PUSHES (New or Updated)
      const pendingPushes = currentEvents.filter(e => e.syncStatus === 'pending_push')
      for (const e of pendingPushes) {
         const gEventPayload = clusterToGoogleEvent(e, projectId)
         try {
            if (e.externalId) {
              // Update existing
              const res = await this.calendar.events.update({
                calendarId: calendarId,
                eventId: e.externalId,
                requestBody: gEventPayload
              })
              e.etag = res.data.etag || undefined
              e.updatedAt = res.data.updated ? new Date(res.data.updated).getTime() : Date.now()
            } else {
              // Create new
              const res = await this.calendar.events.insert({
                calendarId: calendarId,
                requestBody: gEventPayload
              })
              e.externalId = res.data.id || undefined
              e.etag = res.data.etag || undefined
              e.updatedAt = res.data.updated ? new Date(res.data.updated).getTime() : Date.now()
            }
            e.syncStatus = 'synced' as any
            console.log(`[Sync] Pushed to Google: ${e.title}`)
         } catch (err) {
            console.error('Push error', err)
         }
      }

      // 3. PULL REMOTE EVENTS
      // For now, grab events from primary calendar modified recently or incrementally.
      // In a real prod environment we would store syncToken per project.
      const syncTokenKey = `google-sync-token-${projectId}`
      const savedSyncToken = null //store.get(syncTokenKey) as string | undefined
      
      const listParams: any = {
         calendarId: calendarId,
         maxResults: 2500,
         showDeleted: true
      }
      
      // Let's grab all from last 1 year to avoid downloading massive history for now
      // Or if syncToken is used, google doesn't accept timeMin with syncToken
      if (savedSyncToken) {
         // listParams.syncToken = savedSyncToken
      } else {
         const timeMin = new Date()
         timeMin.setMonth(timeMin.getMonth() - 2)
         listParams.timeMin = timeMin.toISOString()
         listParams.singleEvents = true // Always use singleEvents to get individual instances
      }

      let remoteEvents: calendar_v3.Schema$Event[] = []
      try {
         const res = await this.calendar.events.list(listParams)
         if (res.data.items) {
           remoteEvents = res.data.items
         }
         if (res.data.nextSyncToken) {
           // store.set(syncTokenKey, res.data.nextSyncToken)
         }
      } catch (err: any) {
         if (err.code === 410) {
            // syncToken expired, clear it and retry empty next time
            store.delete(syncTokenKey as any)
         }
         console.error('Pull error', err)
      }

      // 4. MERGE / CONFLICT RESOLUTION
      const finalEventsMap = new Map<string, AppEvent>()
      currentEvents.forEach(e => finalEventsMap.set(e.externalId || e.id, e))

      let hasPulledChanges = false

      for (const gRule of remoteEvents) {
         // Only import events that either belong to this project OR don't have a cluster type assigned yet
         const cType = gRule.extendedProperties?.private?.clusterType
         if (cType && gRule.extendedProperties?.private?.projectId !== projectId && cType !== 'project') {
             // Belongs to another project in cluster - ignore.
             // Wait, our mapper didn't inject projectId. Let's assume we import all raw Google Events into our current active workspace context!
         }

         const externalId = gRule.id!

         if (gRule.status === 'cancelled') {
            // Remote deletion
            if (finalEventsMap.has(externalId)) {
               finalEventsMap.delete(externalId)
               hasPulledChanges = true
               console.log(`[Sync] Remote deleted: ${externalId}`)
            }
            continue
         }

         const mapped = googleToClusterEvent(gRule, projectId)
         const localMatch = finalEventsMap.get(externalId)

         if (!localMatch) {
            // Remote item doesn't exist locally -> Insert it
            finalEventsMap.set(externalId, mapped as AppEvent)
            hasPulledChanges = true
            console.log(`[Sync] Pulled new from Google: ${mapped.title}`)
         } else {
            // Conflict check
            if (mapped.updatedAt && localMatch.updatedAt && mapped.updatedAt > localMatch.updatedAt) {
               // Remote is newer -> overwrite local
               finalEventsMap.set(externalId, { ...mapped, id: localMatch.id } as AppEvent) // Keep local UUID just in case
               hasPulledChanges = true
               console.log(`[Sync] Overwrote local with Remote: ${mapped.title}`)
            }
         }
      }

      console.log(`[Sync] Finished. Changes applied: ${hasPulledChanges}`)
      return Array.from(finalEventsMap.values())

    } catch (e: any) {
       console.error('[Sync] Fatal error during sync:', e)
       return localEvents
    }
  }

}

export const syncManager = new GoogleSyncManager()
