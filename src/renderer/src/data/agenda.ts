// Logique d'agenda : CRUD catégories/événements, expansion des occurrences,
// modes d'édition récurrente, rappels. Ne dépend que de l'interface `Db`.
import type { Db } from './db'
import type { CategorieDTO } from '../../../shared/types'

// ─── Catégories ───────────────────────────────────────────────────────────────

function catToDTO(r: Record<string, unknown>): CategorieDTO {
  return {
    id: r.id as number,
    nom: r.nom as string,
    couleur: r.couleur as string,
    emoji: (r.emoji as string | null) ?? null,
    estSysteme: Boolean(r.est_systeme)
  }
}

export function listCategories(db: Db): CategorieDTO[] {
  return (db.prepare('SELECT * FROM categorie ORDER BY id').all() as Record<string, unknown>[]).map(catToDTO)
}

export function createCategorie(db: Db, nom: string, couleur: string, emoji: string | null): CategorieDTO {
  const res = db.prepare('INSERT INTO categorie (nom, couleur, emoji, est_systeme) VALUES (?, ?, ?, 0)')
    .run(nom, couleur, emoji)
  return catToDTO(db.prepare('SELECT * FROM categorie WHERE id = ?').get(res.lastInsertRowid) as Record<string, unknown>)
}

export function deleteCategorie(db: Db, id: number): void {
  // Les catégories système (est_systeme = 1) sont protégées.
  db.prepare('DELETE FROM categorie WHERE id = ? AND est_systeme = 0').run(id)
}
