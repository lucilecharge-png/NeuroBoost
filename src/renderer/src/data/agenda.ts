// Logique d'agenda : CRUD catégories/événements, expansion des occurrences,
// modes d'édition récurrente, rappels. Ne dépend que de l'interface `Db`.
import type { Db } from './db'
import type { CategorieDTO, EvenementDTO, EvenementInput, OccurrenceDTO, ModeRecurrence, RecurrenceRule, RappelOccurrence, NiveauEnergie, CompletionResult } from '../../../shared/types'
import { createTache, terminerTache, deleteTache, annulerCompletion, getProfil } from './game'
import { serialiserRRULE, parserRRULE, expanseRecurrence, parseDateTime, fmtDateTime } from './recurrence'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Déduit un niveau d'énergie de la durée d'un événement (mêmes seuils que les Quêtes).
export function dureeVersEnergie(debut: string, fin: string, allDay: boolean): NiveauEnergie {
  if (allDay) return 'faible'
  const min = (parseDateTime(fin).getTime() - parseDateTime(debut).getTime()) / 60000
  if (min < 5) return 'micro'
  if (min < 15) return 'faible'
  if (min < 45) return 'moyenne'
  return 'haute'
}

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
    recurrence: ev.recurrence,
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

    // Nouvelles dates d'arrivée des overrides (pour ne pas rendre la place en double
    // si l'override atterrit dans la même fenêtre qu'une occurrence normale de la série)
    const nouvellesDatesOverride = new Set(
      (db.prepare(`
        SELECT date(e.debut) AS nd FROM evenement e
        JOIN evenement_exception ex ON ex.override_id = e.id
        WHERE ex.evenement_id = ? AND ex.type = 'deplacee'
          AND date(e.debut) >= ? AND date(e.debut) <= ?
      `).all(m.id, fenetreDebut, fenetreFin) as Record<string, unknown>[])
        .map((r) => r.nd as string)
    )
    // Dates à sauter dans la boucle d'expansion : supprimées OU déplacées (origine)
    // OU dates d'arrivée des overrides (évite double occurrence si la série passe par là)
    const datesToSkip = new Set([...supprimees, ...deplacees.keys(), ...nouvellesDatesOverride])

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
      if (datesToSkip.has(dateOcc)) continue
      occurrences.push(occToDTO(m, debutOcc, dateOcc, true, cats))
    }
  }

  // Overrides (occurrences déplacées) : rendus à leur NOUVELLE date dans la fenêtre
  const overrides = db.prepare(`
    SELECT e.* FROM evenement e
    JOIN evenement_exception ex ON ex.override_id = e.id
    WHERE ex.type = 'deplacee' AND date(e.debut) >= ? AND date(e.debut) <= ?
  `).all(fenetreDebut, fenetreFin) as Record<string, unknown>[]
  for (const ov of overrides) {
    const dateOcc = (ov.debut as string).slice(0, 10)
    occurrences.push(occToDTO(ov, ov.debut as string, dateOcc, false, cats))
  }

  occurrences.sort((a, b) => a.debut.localeCompare(b.debut))
  return occurrences
}

// ─── Édition / suppression avec modes ─────────────────────────────────────────

// Date locale -> veille au format 'YYYY-MM-DD'
function veille(dateOcc: string): string {
  const d = parseDateTime(`${dateOcc} 00:00`)
  d.setDate(d.getDate() - 1)
  return fmtDateTime(d).slice(0, 10)
}

function champsFusionnes(master: Record<string, unknown>, input: Partial<EvenementInput>) {
  const base = evToDTO(master)
  return {
    titre: input.titre ?? base.titre,
    debut: input.debut ?? base.debut,
    fin: input.fin ?? base.fin,
    all_day: (input.allDay ?? base.allDay) ? 1 : 0,
    categorie_id: input.categorieId !== undefined ? input.categorieId : base.categorieId,
    description: input.description !== undefined ? input.description : base.description,
    tache_id: input.tacheId !== undefined ? input.tacheId : base.tacheId,
    rappel_min: input.rappelMin !== undefined ? input.rappelMin : base.rappelMin
  }
}

function updateMaster(db: Db, id: number, c: ReturnType<typeof champsFusionnes>, recurrence: string | null): void {
  db.prepare(`
    UPDATE evenement SET titre=?, debut=?, fin=?, all_day=?, categorie_id=?, description=?, tache_id=?, rappel_min=?, recurrence=?
    WHERE id=?
  `).run(c.titre, c.debut, c.fin, c.all_day, c.categorie_id, c.description, c.tache_id, c.rappel_min, recurrence, id)
}

export function deleteEvenement(db: Db, masterId: number, dateOccurrence: string, mode: ModeRecurrence): void {
  if (mode === 'serie') {
    db.prepare('DELETE FROM evenement WHERE id = ?').run(masterId)
    return
  }
  if (mode === 'occurrence') {
    db.prepare("INSERT INTO evenement_exception (evenement_id, date_occurrence, type) VALUES (?, ?, 'supprimee')")
      .run(masterId, dateOccurrence)
    return
  }
  // suivantes : borne le maître à la veille
  const m = getMaster(db, masterId)
  if (!m) return
  const rule = parserRRULE(m.recurrence as string)
  rule.fin = { type: 'date', date: veille(dateOccurrence) }
  db.prepare('UPDATE evenement SET recurrence = ? WHERE id = ?').run(serialiserRRULE(rule), masterId)
  db.prepare('DELETE FROM evenement_exception WHERE evenement_id = ? AND date_occurrence >= ?')
    .run(masterId, dateOccurrence)
}

export function updateEvenement(
  db: Db, masterId: number, dateOccurrence: string, mode: ModeRecurrence, input: Partial<EvenementInput>
): void {
  const m = getMaster(db, masterId)
  if (!m) return
  const recurrenceActuelle = m.recurrence as string | null

  if (mode === 'serie' || !recurrenceActuelle) {
    const c = champsFusionnes(m, input)
    const rrule = input.recurrence !== undefined
      ? (input.recurrence ? serialiserRRULE(input.recurrence) : null)
      : recurrenceActuelle
    updateMaster(db, masterId, c, rrule)
    return
  }

  if (mode === 'occurrence') {
    const c = champsFusionnes(m, input)
    // Override debut must be on the occurrence's date
    const heure = (m.debut as string).slice(11)
    const debutOcc = input.debut ?? `${dateOccurrence} ${heure}`
    const finOcc = input.fin ?? finDepuisDebut(debutOcc, dureeMs(m.debut as string, m.fin as string))
    const res = db.prepare(`
      INSERT INTO evenement (titre, debut, fin, all_day, categorie_id, description, tache_id, recurrence, rappel_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(c.titre, debutOcc, finOcc, c.all_day, c.categorie_id, c.description, c.tache_id, c.rappel_min)
    db.prepare("INSERT INTO evenement_exception (evenement_id, date_occurrence, type, override_id) VALUES (?, ?, 'deplacee', ?)")
      .run(masterId, dateOccurrence, Number(res.lastInsertRowid))
    return
  }

  // suivantes : borne le maître à la veille, crée un nouveau maître à partir de dateOccurrence
  const rule = parserRRULE(recurrenceActuelle)
  const ruleAncienne: RecurrenceRule = { ...rule, fin: { type: 'date', date: veille(dateOccurrence) } }
  db.prepare('UPDATE evenement SET recurrence = ? WHERE id = ?').run(serialiserRRULE(ruleAncienne), masterId)

  const c = champsFusionnes(m, input)
  const heure = (m.debut as string).slice(11)
  const nouveauDebut = input.debut ?? `${dateOccurrence} ${heure}`
  const nouvelleRecurrence = input.recurrence ? serialiserRRULE(input.recurrence) : serialiserRRULE({ ...rule, fin: undefined })
  const res = db.prepare(`
    INSERT INTO evenement (titre, debut, fin, all_day, categorie_id, description, tache_id, recurrence, rappel_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.titre, nouveauDebut, finDepuisDebut(nouveauDebut, dureeMs(m.debut as string, m.fin as string)),
    c.all_day, c.categorie_id, c.description, c.tache_id, nouvelleRecurrence, c.rappel_min
  )
  db.prepare('UPDATE evenement_exception SET evenement_id = ? WHERE evenement_id = ? AND date_occurrence >= ?')
    .run(Number(res.lastInsertRowid), masterId, dateOccurrence)
}

// ─── Rappels ──────────────────────────────────────────────────────────────────

export function listProchainsRappels(db: Db, maintenant: string, horizonJours: number): RappelOccurrence[] {
  const debutFenetre = maintenant.slice(0, 10)
  const finDate = parseDateTime(`${debutFenetre} 00:00`)
  finDate.setDate(finDate.getDate() + horizonJours)
  const finFenetre = fmtDateTime(finDate).slice(0, 10)

  const maintenantMs = parseDateTime(maintenant).getTime()
  const rappels: RappelOccurrence[] = []

  for (const o of listEvenements(db, debutFenetre, finFenetre)) {
    if (o.rappelMin == null) continue
    const instantRappel = parseDateTime(o.debut).getTime() - o.rappelMin * 60_000
    if (instantRappel >= maintenantMs) {
      rappels.push({ masterId: o.masterId, dateOccurrence: o.dateOccurrence, titre: o.titre, debut: o.debut, rappelMin: o.rappelMin })
    }
  }
  rappels.sort((a, b) => a.debut.localeCompare(b.debut))
  return rappels
}

// ─── Complétion d'événements → quêtes ─────────────────────────────────────────

function nomCategorie(db: Db, categorieId: number | null): string | null {
  if (categorieId == null) return null
  const r = db.prepare('SELECT nom FROM categorie WHERE id = ?').get(categorieId) as { nom: string } | undefined
  return r?.nom ?? null
}

// Marque une occurrence comme faite. Renvoie un CompletionResult vide (zéro gain)
// si l'occurrence est déjà complétée (idempotence).
export function terminerEvenement(db: Db, masterId: number, dateOccurrence: string): CompletionResult {
  const dejaFait = db.prepare(
    'SELECT 1 FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?'
  ).get(masterId, dateOccurrence)
  if (dejaFait) {
    return {
      profil: getProfil(db),
      xpGagne: 0, coinsGagnes: 0, levelUp: false, nouveauNiveau: null, achievementsDebloques: []
    }
  }

  const m = getMaster(db, masterId)
  if (!m) throw new Error(`Événement ${masterId} introuvable`)

  const tacheLiee = m.tache_id as number | null
  let tacheCible: number
  let autoCreee: 0 | 1

  if (tacheLiee != null) {
    const statut = (db.prepare('SELECT statut FROM taches WHERE id = ?').get(tacheLiee) as { statut: string } | undefined)?.statut
    if (statut === 'active' || statut === 'en_cours') {
      tacheCible = tacheLiee
      autoCreee = 0
    } else {
      tacheCible = -1; autoCreee = 1
    }
  } else {
    tacheCible = -1; autoCreee = 1
  }

  if (autoCreee === 1) {
    const energie = dureeVersEnergie(m.debut as string, m.fin as string, Boolean(m.all_day))
    const tache = createTache(db, {
      titre: m.titre as string,
      niveauEnergie: energie,
      categorie: nomCategorie(db, (m.categorie_id as number | null) ?? null)
    })
    tacheCible = tache.id
  }

  const resultat = terminerTache(db, tacheCible)
  db.prepare(
    'INSERT INTO evenement_completion (evenement_id, date_occurrence, tache_id, auto_creee) VALUES (?, ?, ?, ?)'
  ).run(masterId, dateOccurrence, tacheCible, autoCreee)
  return resultat
}

// Annule la complétion d'une occurrence : revert XP/coins, puis supprime la quête
// éclair (auto_creee) ou rouvre la quête liée. No-op si non complétée.
export function annulerEvenement(db: Db, masterId: number, dateOccurrence: string): void {
  const comp = db.prepare(
    'SELECT tache_id, auto_creee FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?'
  ).get(masterId, dateOccurrence) as { tache_id: number | null; auto_creee: number } | undefined
  if (!comp) return

  if (comp.tache_id != null) {
    const tache = db.prepare('SELECT xp_recompense, coins_recompense FROM taches WHERE id = ?')
      .get(comp.tache_id) as { xp_recompense: number; coins_recompense: number } | undefined
    if (tache) {
      annulerCompletion(db, tache.xp_recompense, tache.coins_recompense)
      if (comp.auto_creee === 1) {
        deleteTache(db, comp.tache_id)
      } else {
        db.prepare("UPDATE taches SET statut = 'active', completee_le = NULL WHERE id = ?").run(comp.tache_id)
      }
    }
  }

  db.prepare('DELETE FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?')
    .run(masterId, dateOccurrence)
}
