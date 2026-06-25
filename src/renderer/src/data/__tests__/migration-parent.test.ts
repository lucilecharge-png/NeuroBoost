import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('migration v9 — parent_id', () => {
  it('ajoute la colonne parent_id à taches', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('taches')").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toContain('parent_id')
  })

  it("crée l'index idx_taches_parent", async () => {
    const db = await makeTestDb()
    const idx = (db.prepare("PRAGMA index_list('taches')").all() as { name: string }[]).map((i) => i.name)
    expect(idx).toContain('idx_taches_parent')
  })
})
