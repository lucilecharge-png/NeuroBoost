// Migrations versionnées via PRAGMA user_version. Aucune dépendance navigateur :
// opère sur une instance sql.js `Database` fournie par l'appelant. Partagé entre
// db.ts (init + import) et les tests.
import type { Database } from 'sql.js'
import { MIGRATIONS } from './migrations'

function userVersion(database: Database): number {
  const r = database.exec('PRAGMA user_version')
  return (r[0]?.values?.[0]?.[0] as number) ?? 0
}

// Rejoue les migrations manquantes, chacune dans une transaction. Idempotent.
export function runMigrations(database: Database): void {
  for (let v = userVersion(database); v < MIGRATIONS.length; v++) {
    database.exec('BEGIN')
    try {
      database.exec(MIGRATIONS[v])
      database.exec(`PRAGMA user_version = ${v + 1}`)
      database.exec('COMMIT')
    } catch (e) {
      database.exec('ROLLBACK')
      throw e
    }
  }
}
