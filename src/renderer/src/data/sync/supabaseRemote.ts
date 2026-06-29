import type { SupabaseClient } from '@supabase/supabase-js'
import type { RemoteMeta, SnapshotInfo, SyncRemote } from './types'

const BUCKET = 'db-sync'

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

// Enveloppe les octets dans un Blob backé par un ArrayBuffer frais (satisfait le
// typage BlobPart quelle que soit la provenance du Uint8Array).
function toBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'application/x-sqlite3' })
}

// Crée un adaptateur lié à un utilisateur connecté (userId = auth.uid()).
export function createSupabaseRemote(supabase: SupabaseClient, userId: string): SyncRemote {
  const currentPath = `${userId}/current.sqlite`
  const snapDir = `${userId}/snapshots`
  const storage = supabase.storage.from(BUCKET)

  return {
    async getMeta(): Promise<RemoteMeta | null> {
      const { data, error } = await supabase
        .from('sync_meta')
        .select('version, device_id, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { version: Number(data.version), deviceId: data.device_id, updatedAt: data.updated_at }
    },

    async setMeta(version, deviceId): Promise<RemoteMeta> {
      const updated_at = new Date().toISOString()
      const { error } = await supabase
        .from('sync_meta')
        .upsert({ user_id: userId, version, device_id: deviceId, updated_at }, { onConflict: 'user_id' })
      if (error) throw error
      return { version, deviceId, updatedAt: updated_at }
    },

    async downloadCurrent(): Promise<Uint8Array | null> {
      const { data, error } = await storage.download(currentPath)
      if (error || !data) return null // absent = première synchro
      return blobToBytes(data)
    },

    async uploadCurrent(bytes): Promise<void> {
      const { error } = await storage.upload(currentPath, toBlob(bytes), { upsert: true })
      if (error) throw error
    },

    async copyCurrentToSnapshot(name): Promise<void> {
      const { error } = await storage.copy(currentPath, `${snapDir}/${name}`)
      if (error) throw error
    },

    async uploadSnapshot(name, bytes): Promise<void> {
      const { error } = await storage.upload(`${snapDir}/${name}`, toBlob(bytes), { upsert: true })
      if (error) throw error
    },

    async listSnapshots(): Promise<SnapshotInfo[]> {
      const { data, error } = await storage.list(snapDir, { limit: 1000 })
      if (error) throw error
      return (data ?? []).map((f): SnapshotInfo => ({
        name: f.name,
        createdAt: f.created_at ?? f.name
      }))
    },

    async downloadSnapshot(name): Promise<Uint8Array> {
      const { data, error } = await storage.download(`${snapDir}/${name}`)
      if (error || !data) throw error ?? new Error('Archive introuvable')
      return blobToBytes(data)
    },

    async deleteSnapshots(names): Promise<void> {
      if (names.length === 0) return
      const { error } = await storage.remove(names.map((n) => `${snapDir}/${n}`))
      if (error) throw error
    }
  }
}
