import localforage from 'localforage'
import type { LocalMeta, LocalMetaStore } from './types'

const KEY = 'neuroboost-sync-meta'

function defaults(): LocalMeta {
  return {
    deviceId: crypto.randomUUID(),
    baseVersion: 0,
    lastSyncedHash: '',
    lastSeenHash: '',
    lastEditAt: new Date().toISOString()
  }
}

export const localMetaStore: LocalMetaStore = {
  async get() {
    const stored = await localforage.getItem<LocalMeta>(KEY)
    if (stored) return stored
    const fresh = defaults()
    await localforage.setItem(KEY, fresh)
    return fresh
  },
  async set(meta) {
    await localforage.setItem(KEY, meta)
  }
}
