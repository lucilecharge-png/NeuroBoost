import { describe, it, expect } from 'vitest'
import { runSync } from '../sync/engine'
import type { LocalDb, LocalMeta, LocalMetaStore, RemoteMeta, SnapshotInfo, SyncRemote } from '../sync/types'

const bytesOf = (s: string) => new TextEncoder().encode(s)
const now = () => '2026-03-03T00:00:00Z'

function fakeLocal(initial: string): LocalDb & { content: string } {
  return {
    content: initial,
    export() { return bytesOf(this.content) },
    async import(b) { this.content = new TextDecoder().decode(b) },
    // L'empreinte de contenu suit le même format que le hash de test ("h:<contenu>").
    async fingerprint() { return 'h:' + this.content }
  }
}

function fakeRemote(init?: { current?: string; meta?: RemoteMeta }): SyncRemote & { current: string | null; meta: RemoteMeta | null; snapshots: Record<string, string> } {
  return {
    current: init?.current ?? null,
    meta: init?.meta ?? null,
    snapshots: {},
    async getMeta() { return this.meta },
    async setMeta(version, deviceId) { this.meta = { version, deviceId, updatedAt: now() }; return this.meta },
    async downloadCurrent() { return this.current === null ? null : bytesOf(this.current) },
    async uploadCurrent(b) { this.current = new TextDecoder().decode(b) },
    async copyCurrentToSnapshot(name) { if (this.current !== null) this.snapshots[name] = this.current },
    async uploadSnapshot(name, b) { this.snapshots[name] = new TextDecoder().decode(b) },
    async listSnapshots() { return Object.keys(this.snapshots).map((name): SnapshotInfo => ({ name, createdAt: name })) },
    async downloadSnapshot(name) { return bytesOf(this.snapshots[name]) },
    async deleteSnapshots(names) { for (const n of names) delete this.snapshots[n] }
  }
}

function fakeStore(meta: LocalMeta): LocalMetaStore & { meta: LocalMeta } {
  return { meta, async get() { return this.meta }, async set(m) { this.meta = m } }
}

const baseMeta = (over: Partial<LocalMeta> = {}): LocalMeta => ({
  deviceId: 'devA', baseVersion: 0, lastSyncedHash: '', lastSeenHash: '', lastEditAt: '2026-01-01T00:00:00Z', ...over
})

describe('runSync', () => {
  it('push initial quand aucune base distante', async () => {
    const remote = fakeRemote()
    const local = fakeLocal('v1')
    const store = fakeStore(baseMeta())
    const res = await runSync(remote, local, store, now)
    expect(res.decision).toBe('push')
    expect(remote.current).toBe('v1')
    expect(remote.meta?.version).toBe(1)
    expect(store.meta.baseVersion).toBe(1)
    expect(store.meta.lastSyncedHash).toBe('h:v1')
  })

  it('pull quand le distant a avancé et le local est propre', async () => {
    const remote = fakeRemote({ current: 'remoteV', meta: { version: 7, deviceId: 'devB', updatedAt: now() } })
    const local = fakeLocal('old')
    const store = fakeStore(baseMeta({ baseVersion: 6, lastSyncedHash: 'h:old', lastSeenHash: 'h:old' }))
    const res = await runSync(remote, local, store, now)
    expect(res.decision).toBe('pull')
    expect(res.needsReload).toBe(true)
    expect(local.content).toBe('remoteV')
    expect(store.meta.baseVersion).toBe(7)
  })

  it('divergence → local gagne, archive le distant', async () => {
    const remote = fakeRemote({ current: 'remoteV', meta: { version: 7, deviceId: 'devB', updatedAt: '2026-02-01T00:00:00Z' } })
    const local = fakeLocal('localV')
    const store = fakeStore(baseMeta({ baseVersion: 6, lastSyncedHash: 'h:old', lastSeenHash: 'h:localV', lastEditAt: '2026-02-05T00:00:00Z' }))
    const res = await runSync(remote, local, store, now)
    expect(res.decision).toBe('diverge-local-wins')
    expect(res.archived).toBe(true)
    expect(Object.values(remote.snapshots)).toContain('remoteV')
    expect(remote.current).toBe('localV')
    expect(remote.meta?.version).toBe(8)
  })

  it('divergence → distant gagne, archive le local', async () => {
    const remote = fakeRemote({ current: 'remoteV', meta: { version: 7, deviceId: 'devB', updatedAt: '2026-02-09T00:00:00Z' } })
    const local = fakeLocal('localV')
    const store = fakeStore(baseMeta({ baseVersion: 6, lastSyncedHash: 'h:old', lastSeenHash: 'h:localV', lastEditAt: '2026-02-05T00:00:00Z' }))
    const res = await runSync(remote, local, store, now)
    expect(res.decision).toBe('diverge-remote-wins')
    expect(res.archived).toBe(true)
    expect(Object.values(remote.snapshots)).toContain('localV')
    expect(local.content).toBe('remoteV')
    expect(res.needsReload).toBe(true)
  })

  it('noop quand tout est aligné', async () => {
    const remote = fakeRemote({ current: 'same', meta: { version: 4, deviceId: 'devB', updatedAt: now() } })
    const local = fakeLocal('same')
    const store = fakeStore(baseMeta({ baseVersion: 4, lastSyncedHash: 'h:same', lastSeenHash: 'h:same' }))
    const res = await runSync(remote, local, store, now)
    expect(res.decision).toBe('noop')
  })

  // Régression : deux appareils avec un contenu logiquement identique peuvent
  // produire des octets SQLite différents (agencement physique). L'identité doit
  // reposer sur l'empreinte de CONTENU, pas sur les octets — sinon l'appareil se
  // croit « modifié » et re-pousse en boucle (ping-pong), écrasant l'autre.
  it('reste noop quand seuls les octets d’export changent, pas le contenu', async () => {
    let n = 0
    const local: LocalDb = {
      export() { return bytesOf('octets-volatils-' + n++) }, // octets différents à chaque appel
      async import() {},
      async fingerprint() { return 'contenu-stable' }        // contenu inchangé
    }
    const remote = fakeRemote({ current: 'peu-importe', meta: { version: 5, deviceId: 'devB', updatedAt: now() } })
    const store = fakeStore(baseMeta({ baseVersion: 5, lastSyncedHash: 'contenu-stable', lastSeenHash: 'contenu-stable' }))
    const res = await runSync(remote, local, store, now)
    expect(res.decision).toBe('noop')
  })
})
