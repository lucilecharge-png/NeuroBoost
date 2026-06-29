// Couche données navigateur : SQLite via sql.js (WASM), persisté dans IndexedDB.
// L'adaptateur ci-dessous imite la part de l'API better-sqlite3 utilisée par
// game.ts (prepare().get/all/run, exec, transaction) — ainsi game.ts et
// migrations.ts tournent dans le navigateur sans modification.
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import localforage from 'localforage'
import { runMigrations } from './migrate'
import { contentFingerprint } from './sync/fingerprint'

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

// Empreinte du contenu logique de la base courante (cf. sync/fingerprint).
export function dbContentFingerprint(): Promise<string> {
  if (!dbWrapped) throw new Error('Base non initialisée')
  return contentFingerprint(dbWrapped)
}

// Remplace la base courante par le contenu d'un fichier importé.
// Sûreté : on ne touche dbInstance qu'après validation réussie du fichier.
// IMPORTANT : après un import réussi, l'appelant DOIT recharger la page
// (window.location.reload). window.api (api.ts) garde une référence vers
// l'ancien wrapper ; seul un rechargement réinitialise tout proprement.
export async function importDb(bytes: Uint8Array): Promise<void> {
  if (!SQL || !dbInstance) throw new Error('Base non initialisée')
  const next = new SQL.Database(bytes)
  // sql.js ne valide pas les octets à la construction (lecture paresseuse de
  // l'en-tête SQLite). On force une lecture du schéma : ceci lève si le fichier
  // n'est pas une base SQLite valide ("file is not a database") OU si ce n'est
  // pas une sauvegarde NeuroBoost (table `profil` absente). On valide AVANT
  // runMigrations (sinon les migrations recréeraient le schéma sur une base
  // vide, fabriquant une fausse base "valide") et AVANT de remplacer dbInstance.
  try {
    next.exec('SELECT 1 FROM profil LIMIT 1')
  } catch (err) {
    next.close()
    throw new Error('Fichier de sauvegarde invalide ou illisible', { cause: err })
  }
  next.run('PRAGMA foreign_keys = ON')
  runMigrations(next) // met à niveau un backup d'une version antérieure
  dbInstance = next
  dbWrapped = wrap(next)
  await persist()
}
