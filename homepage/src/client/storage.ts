import type { Bootstrap, StorageBackup } from '../shared/contracts.js';

export type BackupState = 'HEALTHY' | 'OLD' | 'FAILED' | 'NO_DATA';

export function backupAgeSeconds(backup: StorageBackup, now: string) {
  if (backup.lastSuccessfulBackupAt === null) return null;
  return Math.max(0, (Date.parse(now) - Date.parse(backup.lastSuccessfulBackupAt)) / 1_000);
}

export function backupState(backup: StorageBackup, bootstrap: Bootstrap): BackupState {
  if (backup.failureCount !== null && backup.failureCount >= bootstrap.storage.policy.backupFailureThreshold) return 'FAILED';
  const age = backupAgeSeconds(backup, bootstrap.generatedAt);
  if (age === null) return 'NO_DATA';
  if (age > bootstrap.storage.policy.backupWarningAgeSeconds) return 'OLD';
  return 'HEALTHY';
}

export function storageModel(bootstrap: Bootstrap) {
  return {
    pbs: bootstrap.storage.pbs,
    policy: bootstrap.storage.policy,
    backups: bootstrap.storageBackups.map((backup) => ({ backup, state: backupState(backup, bootstrap), ageSeconds: backupAgeSeconds(backup, bootstrap.generatedAt) })),
  };
}
