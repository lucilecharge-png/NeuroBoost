import { decide } from './decision'
import type { LocalDb, LocalMetaStore, SyncRemote, SyncResult } from './types'

const RETENTION = 20

function snapName(iso: string): string {
  return `${iso.replace(/[:.]/g, '-')}.sqlite`
}

async function pruneNames(remote: SyncRemote): Promise<string[]> {
  const snaps = await remote.listSnapshots()
  const sorted = [...snaps].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // récents d'abord
  return sorted.slice(RETENTION).map((s) => s.name)
}

export async function runSync(
  remote: SyncRemote,
  local: LocalDb,
  store: LocalMetaStore,
  now: () => string = () => new Date().toISOString()
): Promise<SyncResult> {
  const meta = await store.get()
  const localBytes = local.export()
  // Identité par CONTENU (pas par octets) : deux appareils aux données
  // identiques ont la même empreinte même si leurs fichiers SQLite diffèrent.
  const localHash = await local.fingerprint()

  // Horloge d'édition : date le moment où le contenu local a changé.
  if (localHash !== meta.lastSeenHash) {
    meta.lastSeenHash = localHash
    meta.lastEditAt = now()
    await store.set(meta)
  }
  const localDirty = localHash !== meta.lastSyncedHash

  const remoteMeta = await remote.getMeta()
  const decision = decide({
    localDirty,
    localEditAt: meta.lastEditAt,
    remoteVersion: remoteMeta?.version ?? null,
    remoteUpdatedAt: remoteMeta?.updatedAt ?? null,
    baseVersion: meta.baseVersion
  })

  if (decision === 'noop') return { decision, archived: false, needsReload: false }

  if (decision === 'push' || decision === 'diverge-local-wins') {
    let archived = false
    if (remoteMeta) { await remote.copyCurrentToSnapshot(snapName(now())); archived = true }
    await remote.uploadCurrent(localBytes)
    const set = await remote.setMeta((remoteMeta?.version ?? 0) + 1, meta.deviceId)
    meta.baseVersion = set.version
    meta.lastSyncedHash = localHash
    await store.set(meta)
    await remote.deleteSnapshots(await pruneNames(remote))
    return { decision, archived, needsReload: false }
  }

  // pull ou diverge-remote-wins : la version distante l'emporte.
  let archived = false
  if (decision === 'diverge-remote-wins') {
    await remote.uploadSnapshot(snapName(now()), localBytes)
    archived = true
  }
  const bytes = await remote.downloadCurrent()
  if (!bytes) return { decision: 'noop', archived, needsReload: false }
  await local.import(bytes)
  // Empreinte du contenu RÉELLEMENT importé (et non des octets téléchargés) :
  // garantit qu'au prochain tour l'appareil se voit « propre » et ne re-pousse pas.
  const h = await local.fingerprint()
  meta.baseVersion = remoteMeta!.version
  meta.lastSyncedHash = h
  meta.lastSeenHash = h
  await store.set(meta)
  if (archived) await remote.deleteSnapshots(await pruneNames(remote))
  return { decision, archived, needsReload: true }
}
