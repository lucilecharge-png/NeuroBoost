// Empreinte du *contenu logique* d'une base NeuroBoost, indépendante de
// l'agencement physique des octets SQLite. Deux appareils dont les données sont
// identiques produisent la même empreinte, même si leurs fichiers .sqlite
// diffèrent (pages libres, ordre de stockage, ré-sérialisation par sql.js).
//
// Sert d'identité « ai-je vraiment changé ? » pour le moteur de synchro, à la
// place du hash des octets bruts qui générait des faux positifs (re-push en
// boucle, divergences faussement « gagnées » écrasant les données de l'autre).
import type { Db } from '../db'
import { sha256 } from './hash'

export async function contentFingerprint(db: Db): Promise<string> {
  // Version de schéma : un upgrade de migration compte comme un changement.
  const uv = db.prepare('PRAGMA user_version').get()
  const version = uv ? Object.values(uv)[0] : 0

  // Toutes les tables utilisateur, ordre stable (hors tables internes SQLite).
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name as string)

  const parts: string[] = [`v=${version}`]
  for (const name of tables) {
    // L'ordre des colonnes (donc des clés JSON) suit le schéma : identique
    // partout. L'ordre des lignes est fixé par rowid pour le déterminisme.
    const rows = db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()
    parts.push(`${name}:${JSON.stringify(rows)}`)
  }

  return sha256(new TextEncoder().encode(parts.join('\n')))
}
