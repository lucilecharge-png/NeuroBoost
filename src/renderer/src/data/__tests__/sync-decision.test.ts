import { describe, it, expect } from 'vitest'
import { decide } from '../sync/decision'

const base = { localDirty: false, localEditAt: '2026-01-01T00:00:00Z', remoteVersion: 5, remoteUpdatedAt: '2026-01-01T00:00:00Z', baseVersion: 5 }

describe('decide', () => {
  it('noop quand rien n’a changé', () => {
    expect(decide(base)).toBe('noop')
  })
  it('push quand seul le local a changé', () => {
    expect(decide({ ...base, localDirty: true })).toBe('push')
  })
  it('pull quand seul le distant a avancé', () => {
    expect(decide({ ...base, remoteVersion: 6 })).toBe('pull')
  })
  it('push si aucune base distante mais contenu local', () => {
    expect(decide({ ...base, localDirty: true, remoteVersion: null, remoteUpdatedAt: null })).toBe('push')
  })
  it('noop si aucune base distante et rien en local', () => {
    expect(decide({ ...base, remoteVersion: null, remoteUpdatedAt: null })).toBe('noop')
  })
  it('divergence → local gagne si édité plus récemment', () => {
    expect(decide({ ...base, localDirty: true, remoteVersion: 6, localEditAt: '2026-02-02T00:00:00Z', remoteUpdatedAt: '2026-02-01T00:00:00Z' })).toBe('diverge-local-wins')
  })
  it('divergence → distant gagne si plus récent', () => {
    expect(decide({ ...base, localDirty: true, remoteVersion: 6, localEditAt: '2026-02-01T00:00:00Z', remoteUpdatedAt: '2026-02-02T00:00:00Z' })).toBe('diverge-remote-wins')
  })
})
