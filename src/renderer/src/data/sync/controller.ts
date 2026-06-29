import { supabase } from '../supabase'
import { exportDb, importDb, dbContentFingerprint } from '../db'
import { runSync } from './engine'
import { localMetaStore } from './localMeta'
import { createSupabaseRemote } from './supabaseRemote'
import { getUser, onAuthChange } from './auth'
import type { LocalDb, SnapshotInfo, SyncStatus } from './types'

const localDb: LocalDb = {
  export: () => exportDb(),
  import: (bytes) => importDb(bytes),
  fingerprint: () => dbContentFingerprint()
}

let status: SyncStatus = 'idle'
const listeners = new Set<(s: SyncStatus) => void>()
let debounce: ReturnType<typeof setTimeout> | null = null
let running = false

function setStatus(s: SyncStatus): void {
  status = s
  for (const l of listeners) l(s)
}

export function getStatus(): SyncStatus { return status }
export function onStatus(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb); cb(status); return () => listeners.delete(cb)
}

export async function syncNow(): Promise<void> {
  if (!supabase || running) return
  if (!navigator.onLine) { setStatus('offline'); return }
  const user = await getUser()
  if (!user) { setStatus('signed-out'); return }
  running = true
  setStatus('syncing')
  try {
    const remote = createSupabaseRemote(supabase, user.id)
    const res = await runSync(remote, localDb, localMetaStore)
    setStatus('synced')
    if (res.needsReload) window.location.reload()
  } catch (err) {
    console.error('[sync] échec', err)
    setStatus('error')
  } finally {
    running = false
  }
}

// Déclencheur débouncé appelé après chaque opération de l'API.
export function scheduleSync(): void {
  if (!supabase) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), 3000)
}

// À appeler une fois au démarrage de l'app.
export function initSyncController(): void {
  if (!supabase) { setStatus('idle'); return }
  onAuthChange((user) => { if (user) void syncNow(); else setStatus('signed-out') })
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncNow() })
  void syncNow() // pull initial
}

// Pour l'UI : liste et restauration d'archives.
export async function listArchives(): Promise<SnapshotInfo[]> {
  if (!supabase) return []
  const user = await getUser()
  if (!user) return []
  return createSupabaseRemote(supabase, user.id).listSnapshots()
}

export async function restoreArchive(name: string): Promise<void> {
  if (!supabase) return
  const user = await getUser()
  if (!user) return
  const remote = createSupabaseRemote(supabase, user.id)
  const bytes = await remote.downloadSnapshot(name)
  await importDb(bytes)
  // L'archive restaurée devient la base locale ; la prochaine synchro la propagera.
  const meta = await localMetaStore.get()
  meta.lastSyncedHash = ''
  meta.lastSeenHash = ''
  meta.lastEditAt = new Date().toISOString()
  await localMetaStore.set(meta)
  window.location.reload()
}
