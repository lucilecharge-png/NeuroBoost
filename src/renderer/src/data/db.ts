// Couche données navigateur : SQLite via sql.js (WASM), persisté dans IndexedDB.
// L'adaptateur ci-dessous imite la part de l'API better-sqlite3 utilisée par
// game.ts (prepare().get/all/run, exec, transaction) — ainsi game.ts et
// migrations.ts tournent dans le navigateur sans modification.
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import localforage from 'localforage'
import { runMigrations } from './migrate'

const STORE_KEY = 'neuroboost-db'

export interface Statement {
  get: (...params: unknown[]) => Record<string, unknown> | undefined
  all: (...params: unknown[]) => Record<string, unknown>[]
  run: (...params: unknown[]) => { lastInsertRowid: number; changes: number }
}

export interface Db {
  prepare: (sql: string) => Statement
  exec: (sql: string) => void
  transaction: (fn: () => void) => () => void
}

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

let SQL: SqlJsStatic | null = null
let dbInstance: Database | null = null
let dbWrapped: Db | null = null

export async function initDb(): Promise<Db> {
  if (dbWrapped) return dbWrapped
  SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const stored = await localforage.getItem<Uint8Array>(STORE_KEY)
  dbInstance = stored ? new SQL.Database(stored) : new SQL.Database()
  dbInstance.run('PRAGMA foreign_keys = ON')

  // Migrations versionnées (même mécanique que la version Electron)
  runMigrations(dbInstance)

  dbWrapped = wrap(dbInstance)
  await persist()
  return dbWrapped
}

let persistTimer: ReturnType<typeof setTimeout> | null = null

// Sauvegarde différée (coalesce les écritures rapprochées) — la DB est petite.
export function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => void persist(), 200)
}

export async function persist(): Promise<void> {
  if (!dbInstance) return
  await localforage.setItem(STORE_KEY, dbInstance.export())
}

// ── Sauvegarde / restauration par fichier ──

// Sérialise la base courante en fichier SQLite complet (Uint8Array).
export function exportDb(): Uint8Array {
  if (!dbInstance) throw new Error('Base non initialisée')
  return dbInstance.export()
}

// Remplace la base courante par le contenu d'un fichier importé.
// Sûreté : on ne touche dbInstance qu'après validation réussie du fichier.
export async function importDb(bytes: Uint8Array): Promise<void> {
  if (!SQL) throw new Error('Base non initialisée')
  // Lève si le fichier n'est pas une base SQLite valide — avant tout remplacement.
  const next = new SQL.Database(bytes)
  next.run('PRAGMA foreign_keys = ON')
  runMigrations(next) // met à niveau un backup d'une version antérieure
  dbInstance = next
  dbWrapped = wrap(next)
  await persist()
}
