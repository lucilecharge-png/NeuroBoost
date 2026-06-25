// DB sql.js en mémoire pour les tests de logique. Conforme à l'interface `Db`
// utilisée par game.ts/agenda.ts. Aucune persistance, aucune dépendance navigateur.
import initSqlJs, { type Database } from 'sql.js'
import { createRequire } from 'module'
import type { Db } from '../db'
import { MIGRATIONS } from '../migrations'

const require = createRequire(import.meta.url)

function wrap(database: Database): Db {
  return {
    prepare(sql) {
      return {
        get(...params) {
          const stmt = database.prepare(sql)
          try {
            stmt.bind(params as never)
            return stmt.step() ? (stmt.getAsObject() as Record<string, unknown>) : undefined
          } finally {
            stmt.free()
          }
        },
        all(...params) {
          const stmt = database.prepare(sql)
          const rows: Record<string, unknown>[] = []
          try {
            stmt.bind(params as never)
            while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>)
          } finally {
            stmt.free()
          }
          return rows
        },
        run(...params) {
          database.run(sql, params as never)
          const r = database.exec('SELECT last_insert_rowid() AS id, changes() AS c')
          const vals = r[0]?.values?.[0] ?? [0, 0]
          return { lastInsertRowid: Number(vals[0]), changes: Number(vals[1]) }
        }
      }
    },
    exec(sql) {
      database.exec(sql)
    },
    transaction(fn) {
      return () => {
        database.exec('BEGIN')
        try {
          fn()
          database.exec('COMMIT')
        } catch (e) {
          database.exec('ROLLBACK')
          throw e
        }
      }
    }
  }
}

export async function makeTestDb(): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
  const database = new SQL.Database()
  database.run('PRAGMA foreign_keys = ON')
  for (const migration of MIGRATIONS) database.exec(migration)
  return wrap(database)
}
