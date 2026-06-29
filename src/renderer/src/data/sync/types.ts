export type RemoteMeta = { version: number; updatedAt: string; deviceId: string }
export type SnapshotInfo = { name: string; createdAt: string }

export interface SyncRemote {
  getMeta(): Promise<RemoteMeta | null>
  setMeta(version: number, deviceId: string): Promise<RemoteMeta>
  downloadCurrent(): Promise<Uint8Array | null>
  uploadCurrent(bytes: Uint8Array): Promise<void>
  copyCurrentToSnapshot(name: string): Promise<void>
  uploadSnapshot(name: string, bytes: Uint8Array): Promise<void>
  listSnapshots(): Promise<SnapshotInfo[]>
  downloadSnapshot(name: string): Promise<Uint8Array>
  deleteSnapshots(names: string[]): Promise<void>
}

export interface LocalDb {
  export(): Uint8Array
  import(bytes: Uint8Array): Promise<void>
}

export type LocalMeta = {
  deviceId: string
  baseVersion: number
  lastSyncedHash: string
  lastSeenHash: string
  lastEditAt: string
}

export interface LocalMetaStore {
  get(): Promise<LocalMeta>
  set(meta: LocalMeta): Promise<void>
}

export type SyncDecision =
  | 'noop' | 'push' | 'pull' | 'diverge-local-wins' | 'diverge-remote-wins'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'signed-out'

export type SyncResult = {
  decision: SyncDecision
  archived: boolean
  needsReload: boolean
}
