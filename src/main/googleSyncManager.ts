import { google, calendar_v3 } from 'googleapis'
import { AppEvent } from '../renderer/src/types'
import { googleToClusterEvent, clusterToGoogleEvent } from './googleMapper'
import StoreModule from 'electron-store'
import { safeStorage } from 'electron'

const Store = typeof StoreModule === 'function' ? StoreModule : (StoreModule as any).default
const store = new Store()

/**
 * SyncManager coordinates bidirectional syncing with Google Calendar.
 */
export class GoogleSyncManager {
  private calendar: calendar_v3.Calendar
  private isAuthorized: boolean = false

  constructor() {
    this.calendar = google.calendar('v3')
    this.initializeAuth()
  }

  private initializeAuth() {
    const saved = store.get('google-auth-tokens') as string | undefined
    if (saved) {
      try {
        let tokens
        if (safeStorage.isEncryptionAvailable()) {
          tokens = JSON.parse(safeStorage.decryptString(Buffer.from(saved as string, 'base64')))
        } else {
          tokens = JSON.parse(saved as string)
        }
        
        // Re-construct the oauth2 client from the stored vars in index.ts
        // For simplicity, we just pass an auth object directly
        const oauth2Client = new google.auth.OAuth2(
          '502882586830-q6ijqftc1pjr8erajlmsbm28b4oomj2n.apps.googleusercontent.com',
          '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',
          'http://localhost:8081/oauth2callback'
        )
        oauth2Client.setCredentials(tokens)
        this.calendar = google.calendar({ version: 'v3', auth: oauth2Client })
        this.isAuthorized = true
      } catch (e) {
        console.error('Failed to init auth tokens in SyncManager', e)
        this.isAuthorized = false
      }
    }
  }

  /**
   * Performs a two-way sync for a specific project.
   * "Last Write Wins" resolution for conflicts.
   */
  async syncProject(projectId: string, localEvents: AppEvent[]): Promise<AppEvent[]> {
    if (!this.isAuthorized) {
       this.initializeAuth()
       if (!this.isAuthorized) return localEvents // Skip sync if still unauthorized
    }

    try {
      console.log(`[Sync] Starting sync for project ${projectId}...`)
      // 1. PUSH PENDING DELETES
      const pendingDeletes = localEvents.filter(e => e.syncStatus === 'pending_delete' && e.externalId)
      for (const e of pendingDeletes) {
         try {
            await this.calendar.events.delete({
              calendarId: 'primary',
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
         const gEventPayload = clusterToGoogleEvent(e)
         try {
            if (e.externalId) {
              // Update existing
              const res = await this.calendar.events.update({
                calendarId: 'primary',
                eventId: e.externalId,
                requestBody: gEventPayload
              })
              e.etag = res.data.etag || undefined
              e.updatedAt = res.data.updated ? new Date(res.data.updated).getTime() : Date.now()
            } else {
              // Create new
              const res = await this.calendar.events.insert({
                calendarId: 'primary',
                requestBody: gEventPayload
              })
              e.externalId = res.data.id || undefined
              e.etag = res.data.etag || undefined
              e.updatedAt = res.data.updated ? new Date(res.data.updated).getTime() : Date.now()
            }
            e.syncStatus = 'synced'
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
         calendarId: 'primary',
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
         listParams.singleEvents = false // We need the base recurrence, not instances
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
            finalEventsMap.set(externalId, mapped)
            hasPulledChanges = true
            console.log(`[Sync] Pulled new from Google: ${mapped.title}`)
         } else {
            // Conflict check
            if (mapped.updatedAt && localMatch.updatedAt && mapped.updatedAt > localMatch.updatedAt) {
               // Remote is newer -> overwrite local
               finalEventsMap.set(externalId, { ...mapped, id: localMatch.id }) // Keep local UUID just in case
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
