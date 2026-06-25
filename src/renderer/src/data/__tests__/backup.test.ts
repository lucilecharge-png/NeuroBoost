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
