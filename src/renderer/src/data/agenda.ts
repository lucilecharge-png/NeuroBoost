// Logique d'agenda : CRUD catégories/événements, expansion des occurrences,
// modes d'édition récurrente, rappels. Ne dépend que de l'interface `Db`.
import type { Db } from './db'
import type { CategorieDTO, EvenementDTO, EvenementInput, OccurrenceDTO } from '../../../shared/types'
import { serialiserRRULE, parserRRULE, expanseRecurrence, parseDateTime, fmtDateTime } from './recurrence'

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

// ─── Événements ───────────────────────────────────────────────────────────────

function evToDTO(r: Record<string, unknown>): EvenementDTO {
  const rrule = r.recurrence as string | null
  return {
    id: r.id as number,
    titre: r.titre as string,
    debut: r.debut as string,
    fin: r.fin as string,
    allDay: Boolean(r.all_day),
    categorieId: (r.categorie_id as number | null) ?? null,
    description: (r.description as string | null) ?? null,
    tacheId: (r.tache_id as number | null) ?? null,
    recurrence: rrule ? parserRRULE(rrule) : null,
    rappelMin: (r.rappel_min as number | null) ?? null
  }
}

function getMaster(db: Db, id: number): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM evenement WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function createEvenement(db: Db, input: EvenementInput): EvenementDTO {
  const rrule = input.recurrence ? serialiserRRULE(input.recurrence) : null
  const res = db.prepare(`
    INSERT INTO evenement (titre, debut, fin, all_day, categorie_id, description, tache_id, recurrence, rappel_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.titre, input.debut, input.fin, input.allDay ? 1 : 0,
    input.categorieId ?? null, input.description ?? null, input.tacheId ?? null,
    rrule, input.rappelMin ?? null
  )
  return evToDTO(getMaster(db, Number(res.lastInsertRowid)) as Record<string, unknown>)
}

// Durée d'un maître en millisecondes (pour reporter la fin sur une occurrence)
function dureeMs(debut: string, fin: string): number {
  return parseDateTime(fin).getTime() - parseDateTime(debut).getTime()
}

function finDepuisDebut(debutOcc: string, duree: number): string {
  return fmtDateTime(new Date(parseDateTime(debutOcc).getTime() + duree))
}

function occToDTO(
  master: Record<string, unknown>,
  debutOcc: string,
  dateOcc: string,
  estRecurrent: boolean,
  categories: Map<number, CategorieDTO>
): OccurrenceDTO {
  const ev = evToDTO(master)
  return {
    masterId: ev.id,
    dateOccurrence: dateOcc,
    titre: ev.titre,
    debut: debutOcc,
    fin: finDepuisDebut(debutOcc, dureeMs(ev.debut, ev.fin)),
    allDay: ev.allDay,
    categorie: ev.categorieId ? (categories.get(ev.categorieId) ?? null) : null,
    description: ev.description,
    tacheId: ev.tacheId,
    estRecurrent,
    rappelMin: ev.rappelMin
  }
}

export function listEvenements(db: Db, fenetreDebut: string, fenetreFin: string): OccurrenceDTO[] {
  const cats = new Map(listCategories(db).map((c) => [c.id, c]))

  const masters = db.prepare(`
    SELECT * FROM evenement
    WHERE id NOT IN (SELECT override_id FROM evenement_exception WHERE override_id IS NOT NULL)
      AND (recurrence IS NOT NULL OR (date(debut) <= ? AND date(fin) >= ?))
  `).all(fenetreFin, fenetreDebut) as Record<string, unknown>[]

  const occurrences: OccurrenceDTO[] = []

  for (const m of masters) {
    const exceptions = db.prepare('SELECT * FROM evenement_exception WHERE evenement_id = ?')
      .all(m.id) as Record<string, unknown>[]
    const supprimees = new Set(exceptions.filter((e) => e.type === 'supprimee').map((e) => e.date_occurrence as string))
    const deplacees = new Map(
      exceptions.filter((e) => e.type === 'deplacee' && e.override_id != null)
        .map((e) => [e.date_occurrence as string, e.override_id as number])
    )

    const rrule = m.recurrence as string | null
    if (!rrule) {
      const dateOcc = (m.debut as string).slice(0, 10)
      if (dateOcc >= fenetreDebut && dateOcc <= fenetreFin) {
        occurrences.push(occToDTO(m, m.debut as string, dateOcc, false, cats))
      }
      continue
    }

    const rule = parserRRULE(rrule)
    for (const debutOcc of expanseRecurrence(rule, m.debut as string, fenetreDebut, fenetreFin)) {
      const dateOcc = debutOcc.slice(0, 10)
      if (supprimees.has(dateOcc)) continue
      const overrideId = deplacees.get(dateOcc)
      if (overrideId != null) {
        const ov = getMaster(db, overrideId)
        if (ov) {
          const od = (ov.debut as string).slice(0, 10)
          if (od >= fenetreDebut && od <= fenetreFin) {
            occurrences.push(occToDTO(ov, ov.debut as string, dateOcc, true, cats))
          }
        }
        continue
      }
      occurrences.push(occToDTO(m, debutOcc, dateOcc, true, cats))
    }
  }

  occurrences.sort((a, b) => a.debut.localeCompare(b.debut))
  return occurrences
}
