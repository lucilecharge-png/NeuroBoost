import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('migration v11 — evenement_completion', () => {
  it('crée la table evenement_completion', async () => {
    const db = await makeTestDb()
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((t) => t.name)
    expect(tables).toContain('evenement_completion')
  })

  it('a les colonnes attendues', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('evenement_completion')").all() as { name: string }[])
      .map((c) => c.name)
    expect(cols).toEqual(
      expect.arrayContaining(['evenement_id', 'date_occurrence', 'tache_id', 'auto_creee', 'completee_le'])
    )
  })
})
