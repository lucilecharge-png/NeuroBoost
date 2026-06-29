import type { SyncDecision } from './types'

export function decide(input: {
  localDirty: boolean
  localEditAt: string
  remoteVersion: number | null
  remoteUpdatedAt: string | null
  baseVersion: number
}): SyncDecision {
  const { localDirty, localEditAt, remoteVersion, remoteUpdatedAt, baseVersion } = input
  if (remoteVersion === null) return localDirty ? 'push' : 'noop'
  const remoteAdvanced = remoteVersion > baseVersion
  if (!remoteAdvanced && !localDirty) return 'noop'
  if (!remoteAdvanced && localDirty) return 'push'
  if (remoteAdvanced && !localDirty) return 'pull'
  return localEditAt >= (remoteUpdatedAt ?? '') ? 'diverge-local-wins' : 'diverge-remote-wins'
}
