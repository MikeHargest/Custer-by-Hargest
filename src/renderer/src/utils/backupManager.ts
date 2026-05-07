import { AppNote } from '../types'

export interface BackupReason {
  type: 'interval' | 'switch' | 'manual' | 'restore-preflight'
}

export interface BackupConfig {
  backupIntervalMinutes: number
  boardBackupIntervalMinutes: number
  disableBoardBackups: boolean
}

export const shouldCreateBackup = (
  note: AppNote,
  reason: BackupReason['type'],
  config: BackupConfig,
  lastBackupAt: number,
  lastHash: string,
  currentHash: string
): boolean => {
  // If it's a board and backups are disabled, only allow manual or restore-preflight
  if (note.type === 'board' && config.disableBoardBackups) {
    if (reason === 'interval' || reason === 'switch') {
      return false
    }
  }

  // Manual and pre-restore backups are always allowed
  if (reason === 'manual' || reason === 'restore-preflight') {
    return true
  }

  // Check for changes
  if (lastHash === currentHash) {
    return false
  }

  // Check cooldown
  const intervalMinutes = note.type === 'board' ? config.boardBackupIntervalMinutes : config.backupIntervalMinutes
  const minIntervalMs = Math.max(1, intervalMinutes) * 60 * 1000
  const now = Date.now()
  
  if (now - lastBackupAt < minIntervalMs) {
    return false
  }

  return true
}
