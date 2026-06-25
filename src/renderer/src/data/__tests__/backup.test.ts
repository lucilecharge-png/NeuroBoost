import { describe, it, expect } from 'vitest'
import initSqlJs from 'sql.js'
import { createRequire } from 'module'
import { runMigrations } from '../migrate'
import { MIGRATIONS } from '../migrations'

const require = createRequire(import.meta.url)

async function loadSql() {
  return initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
}

describe('runMigrations', () => {
  it('applique toutes les migrations et fixe user_version', async () => {
    const SQL = await loadSql()
    const db = new SQL.Database()
    runMigrations(db)
    const version = db.exec('PRAGMA user_version')[0].values[0][0]
    expect(version).toBe(MIGRATIONS.length)
    // Le profil seed existe (preuve que les migrations ont tourné)
    const r = db.exec("SELECT pseudo FROM profil WHERE id = 1")
    expect(r[0].values[0][0]).toBe('Héros')
  })

  it('est idempotent (ne rejoue pas les migrations déjà appliquées)', async () => {
    const SQL = await loadSql()
    const db = new SQL.Database()
    runMigrations(db)
    runMigrations(db) // 2e passage : ne doit pas relever d'erreur "table exists"
    const version = db.exec('PRAGMA user_version')[0].values[0][0]
    expect(version).toBe(MIGRATIONS.length)
  })
})

describe('round-trip de sauvegarde (mécanisme export/import)', () => {
  it('préserve les données après export puis reload', async () => {
    const SQL = await loadSql()

    // Base source avec une donnée modifiée
    const source = new SQL.Database()
    runMigrations(source)
    source.run("UPDATE profil SET pseudo = ? WHERE id = 1", ['Lucile'])

    // Export (ce que fait exportDb) → bytes
    const bytes = source.export()

    // Import (ce que fait importDb) → nouvelle instance + migrations
    const restored = new SQL.Database(bytes)
    restored.run('PRAGMA foreign_keys = ON')
    runMigrations(restored) // no-op ici, mais mettrait à niveau un vieux backup

    const r = restored.exec("SELECT pseudo FROM profil WHERE id = 1")
    expect(r[0].values[0][0]).toBe('Lucile')
  })

  it('rejette un fichier qui n\'est pas une base SQLite', async () => {
    const SQL = await loadSql()
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    expect(() => new SQL.Database(garbage)).toThrow()
  })
})
