// Logique de jeu : XP, niveaux, achievements, coins — toute la mécanique centrale.
import type { Db } from './db'
import type { ProfilDTO, AchievementDTO, CompletionResult, TacheDTO, NiveauEnergieJour, EnergieDTO, CaptureDTO, RecompenseDTO, SessionFocusDTO, StatsDTO, ConsistanceDTO, StatutTache, NiveauEnergie, VictoireDTO, MatriceItemDTO, ReveDTO, CapsuleDTO, BilanReponseDTO, RevueHebdoDTO, RevueReponse, RendezVousDTO } from '../../../shared/types'

// ─── XP / Niveaux ─────────────────────────────────────────────────────────────

function xpPourNiveau(niveau: number): number {
  return niveau * 100
}

// Avatar « système solaire » : s'illumine et grandit au fil des niveaux,
// de la nouvelle lune jusqu'au soleil.
function avatarEmoji(niveau: number): string {
  if (niveau >= 20) return '☀️'
  if (niveau >= 15) return '🌟'
  if (niveau >= 10) return '🪐'
  if (niveau >= 6) return '🌕'
  if (niveau >= 3) return '🌓'
  return '🌑'
}

// ─── Profil ───────────────────────────────────────────────────────────────────

function profilToDTO(r: Record<string, unknown>): ProfilDTO {
  return {
    pseudo: r.pseudo as string,
    niveau: r.niveau as number,
    xp: r.xp as number,
    xpProchainNiveau: r.xp_prochain_niveau as number,
    neurocoins: r.neurocoins as number,
    streakJours: r.streak_jours as number,
    derniereConnexion: (r.derniere_connexion as string | null) ?? null,
    avatarEmoji: avatarEmoji(r.niveau as number),
    totalTachesTerminees: r.total_taches_terminees as number
  }
}

export function getProfil(db: Db): ProfilDTO {
  return profilToDTO(db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>)
}

export function setPseudo(db: Db, pseudo: string): ProfilDTO {
  db.prepare('UPDATE profil SET pseudo = ? WHERE id = 1').run(pseudo)
  return getProfil(db)
}

function today(): string { return new Date().toISOString().slice(0, 10) }

export function connexionJournaliere(db: Db): { profil: ProfilDTO; streakBonus: number } {
  const profil = db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>
  const hier = new Date(); hier.setDate(hier.getDate() - 1)
  const hierStr = hier.toISOString().slice(0, 10)
  const derniereConnexion = profil.derniere_connexion as string | null
  const todayStr = today()

  if (derniereConnexion === todayStr) {
    return { profil: profilToDTO(profil), streakBonus: 0 }
  }

  let streakJours = profil.streak_jours as number
  if (derniereConnexion === hierStr) {
    streakJours += 1
  } else if (derniereConnexion !== todayStr) {
    streakJours = 1 // reset
  }

  const streakBonus = streakJours > 1 ? Math.min(streakJours * 2, 20) : 0
  db.prepare(`
    UPDATE profil SET derniere_connexion = ?, streak_jours = ?, neurocoins = neurocoins + ? WHERE id = 1
  `).run(todayStr, streakJours, streakBonus)

  // Vérifier achievement streak
  if (streakJours >= 7) _debloquerAchievement(db, 'semaine_feu')
  if (streakJours >= 30) _debloquerAchievement(db, 'semaine_feu_2')

  return { profil: getProfil(db), streakBonus }
}

// ─── Tâches ───────────────────────────────────────────────────────────────────

const XP_PAR_ENERGIE: Record<string, number> = { micro: 5, faible: 15, moyenne: 30, haute: 60 }
const COINS_PAR_ENERGIE: Record<string, number> = { micro: 3, faible: 7, moyenne: 15, haute: 30 }

function tacheToDTO(r: Record<string, unknown>): TacheDTO {
  return {
    id: r.id as number,
    titre: r.titre as string,
    description: (r.description as string | null) ?? null,
    niveauEnergie: r.niveau_energie as NiveauEnergie,
    dureeEstimeeMin: r.duree_estimee_min as number,
    xpRecompense: r.xp_recompense as number,
    coinsRecompense: r.coins_recompense as number,
    statut: r.statut as StatutTache,
    categorie: (r.categorie as string | null) ?? null,
    estMissionJour: Boolean(r.est_mission_jour),
    estPivot: Boolean(r.est_pivot),
    pourquoi: (r.pourquoi as string | null) ?? null,
    completedLe: (r.completee_le as string | null) ?? null,
    creeLe: r.cree_le as string,
    parentId: (r.parent_id as number | null) ?? null
  }
}

export function getMissionsJour(db: Db): TacheDTO[] {
  const missions = db.prepare("SELECT * FROM taches WHERE est_mission_jour = 1 AND statut IN ('active','en_cours') ORDER BY niveau_energie ASC").all() as Record<string, unknown>[]
  if (missions.length > 0) return missions.map(tacheToDTO)
  return regenererMissions(db)
}

export function regenererMissions(db: Db): TacheDTO[] {
  // Annuler les anciennes missions non terminées
  db.prepare("UPDATE taches SET est_mission_jour = 0 WHERE est_mission_jour = 1 AND statut = 'active'").run()
  // Choisir 3 tâches actives en variant les niveaux d'énergie
  const micro = db.prepare("SELECT * FROM taches WHERE statut = 'active' AND niveau_energie = 'micro' ORDER BY RANDOM() LIMIT 1").get()
  const faible = db.prepare("SELECT * FROM taches WHERE statut = 'active' AND niveau_energie = 'faible' ORDER BY RANDOM() LIMIT 1").get()
  const moyenne = db.prepare("SELECT * FROM taches WHERE statut = 'active' AND niveau_energie IN ('moyenne','haute') ORDER BY RANDOM() LIMIT 1").get()
  const candidats = [micro, faible, moyenne].filter(Boolean) as Record<string, unknown>[]
  // Si pas assez → prendre n'importe quoi
  if (candidats.length < 3) {
    const autres = db.prepare(`SELECT * FROM taches WHERE statut = 'active' AND id NOT IN (${candidats.map((c) => c.id).join(',') || '0'}) ORDER BY RANDOM() LIMIT ${3 - candidats.length}`).all() as Record<string, unknown>[]
    candidats.push(...autres)
  }
  if (candidats.length === 0) return []
  const ids = candidats.map((c) => c.id)
  db.prepare(`UPDATE taches SET est_mission_jour = 1 WHERE id IN (${ids.join(',')})`).run()
  return (db.prepare(`SELECT * FROM taches WHERE id IN (${ids.join(',')}) ORDER BY niveau_energie ASC`).all() as Record<string, unknown>[]).map(tacheToDTO)
}

export function listTaches(db: Db, filtres: { statut?: StatutTache; energie?: NiveauEnergie } = {}): TacheDTO[] {
  let sql = `SELECT * FROM taches WHERE 1=1
    AND NOT EXISTS (
      SELECT 1 FROM taches enfant
      WHERE enfant.parent_id = taches.id
        AND enfant.statut IN ('active','en_cours')
    )`
  const params: unknown[] = []
  if (filtres.statut) { sql += ' AND statut = ?'; params.push(filtres.statut) }
  if (filtres.energie) { sql += ' AND niveau_energie = ?'; params.push(filtres.energie) }
  sql += ' ORDER BY est_mission_jour DESC, CASE niveau_energie WHEN \'micro\' THEN 0 WHEN \'faible\' THEN 1 WHEN \'moyenne\' THEN 2 ELSE 3 END, cree_le DESC'
  return (db.prepare(sql).all(...params) as Record<string, unknown>[]).map(tacheToDTO)
}

export function createTache(db: Db, input: { titre: string; description?: string | null; niveauEnergie?: NiveauEnergie; dureeEstimeeMin?: number; categorie?: string | null; pourquoi?: string | null }): TacheDTO {
  const energie = input.niveauEnergie ?? 'faible'
  const res = db.prepare(`
    INSERT INTO taches (titre, description, niveau_energie, duree_estimee_min, xp_recompense, coins_recompense, categorie, pourquoi)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.titre,
    input.description ?? null,
    energie,
    input.dureeEstimeeMin ?? 15,
    XP_PAR_ENERGIE[energie],
    COINS_PAR_ENERGIE[energie],
    input.categorie ?? null,
    input.pourquoi ?? null
  )
  return tacheToDTO(db.prepare('SELECT * FROM taches WHERE id = ?').get(res.lastInsertRowid) as Record<string, unknown>)
}

export function creerSousTaches(
  db: Db,
  parentId: number,
  sousTaches: { titre: string; description?: string | null; niveauEnergie?: NiveauEnergie; dureeEstimeeMin?: number; categorie?: string | null; pourquoi?: string | null }[]
): TacheDTO[] {
  const ids: number[] = []
  const insert = db.transaction(() => {
    for (const st of sousTaches) {
      const energie = st.niveauEnergie ?? 'faible'
      const res = db.prepare(`
        INSERT INTO taches (titre, description, niveau_energie, duree_estimee_min, xp_recompense, coins_recompense, categorie, pourquoi, parent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        st.titre,
        st.description ?? null,
        energie,
        st.dureeEstimeeMin ?? 15,
        XP_PAR_ENERGIE[energie],
        COINS_PAR_ENERGIE[energie],
        st.categorie ?? null,
        st.pourquoi ?? null,
        parentId
      )
      ids.push(res.lastInsertRowid)
    }
  })
  insert()
  if (ids.length === 0) return []
  return (db.prepare(`SELECT * FROM taches WHERE id IN (${ids.join(',')}) ORDER BY id ASC`).all() as Record<string, unknown>[]).map(tacheToDTO)
}

export function updateTache(db: Db, id: number, input: Partial<{ titre: string; description: string | null; niveauEnergie: NiveauEnergie; dureeEstimeeMin: number; categorie: string | null; pourquoi: string | null }>): TacheDTO {
  const fields: string[] = []
  const values: unknown[] = []
  if (input.titre !== undefined) { fields.push('titre = ?'); values.push(input.titre) }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description) }
  if (input.niveauEnergie !== undefined) {
    fields.push('niveau_energie = ?'); values.push(input.niveauEnergie)
    fields.push('xp_recompense = ?'); values.push(XP_PAR_ENERGIE[input.niveauEnergie])
    fields.push('coins_recompense = ?'); values.push(COINS_PAR_ENERGIE[input.niveauEnergie])
  }
  if (input.dureeEstimeeMin !== undefined) { fields.push('duree_estimee_min = ?'); values.push(input.dureeEstimeeMin) }
  if (input.categorie !== undefined) { fields.push('categorie = ?'); values.push(input.categorie) }
  if (input.pourquoi !== undefined) { fields.push('pourquoi = ?'); values.push(input.pourquoi) }
  if (fields.length > 0) { values.push(id); db.prepare(`UPDATE taches SET ${fields.join(', ')} WHERE id = ?`).run(...values) }
  return tacheToDTO(db.prepare('SELECT * FROM taches WHERE id = ?').get(id) as Record<string, unknown>)
}

export function demarrerTache(db: Db, id: number): TacheDTO {
  db.prepare("UPDATE taches SET statut = 'en_cours' WHERE id = ?").run(id)
  return tacheToDTO(db.prepare('SELECT * FROM taches WHERE id = ?').get(id) as Record<string, unknown>)
}

export function terminerTache(db: Db, id: number, _dureeReelleMin?: number): CompletionResult {
  const tache = db.prepare('SELECT * FROM taches WHERE id = ?').get(id) as Record<string, unknown>
  const xp = tache.xp_recompense as number
  const coins = tache.coins_recompense as number

  db.prepare(`UPDATE taches SET statut = 'terminee', completee_le = datetime('now','localtime') WHERE id = ?`).run(id)

  // Mise à jour profil : XP + coins
  const profil = db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>
  const ancienNiveau = profil.niveau as number
  let nouveauXP = (profil.xp as number) + xp
  let nouveauNiveau = ancienNiveau
  let xpProchain = profil.xp_prochain_niveau as number

  while (nouveauXP >= xpProchain) {
    nouveauXP -= xpProchain
    nouveauNiveau += 1
    xpProchain = xpPourNiveau(nouveauNiveau)
  }

  const levelUp = nouveauNiveau > ancienNiveau
  const nouveauTotal = (profil.total_taches_terminees as number) + 1

  db.prepare(`
    UPDATE profil SET xp = ?, niveau = ?, xp_prochain_niveau = ?, neurocoins = neurocoins + ?, total_taches_terminees = ? WHERE id = 1
  `).run(nouveauXP, nouveauNiveau, xpProchain, coins, nouveauTotal)

  // Achievements
  const debloques: AchievementDTO[] = []
  if (nouveauTotal === 1) debloques.push(..._debloquerAchievement(db, 'premier_pas'))
  if (tache.niveau_energie === 'micro') {
    const nbMicro = (db.prepare("SELECT COUNT(*) as n FROM taches WHERE niveau_energie = 'micro' AND statut = 'terminee'").get() as { n: number }).n
    if (nbMicro >= 10) debloques.push(..._debloquerAchievement(db, 'micro_hero'))
  }
  const nbAujourdHui = (db.prepare("SELECT COUNT(*) as n FROM taches WHERE date(completee_le) = date('now','localtime') AND statut = 'terminee'").get() as { n: number }).n
  if (nbAujourdHui >= 3) debloques.push(..._debloquerAchievement(db, 'momentum'))
  const missionsJour = db.prepare("SELECT COUNT(*) as n FROM taches WHERE est_mission_jour = 1 AND statut = 'terminee' AND date(completee_le) = date('now','localtime')").get() as { n: number }
  if (missionsJour.n >= 3) debloques.push(..._debloquerAchievement(db, 'chasseur'))
  if (nouveauNiveau >= 5) debloques.push(..._debloquerAchievement(db, 'niveau_5'))
  if (nouveauNiveau >= 10) debloques.push(..._debloquerAchievement(db, 'niveau_10'))
  const profilFinal = db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>
  if ((profilFinal.neurocoins as number) >= 100) debloques.push(..._debloquerAchievement(db, 'collecteur'))

  const resultat: CompletionResult = {
    profil: profilToDTO(profilFinal),
    xpGagne: xp,
    coinsGagnes: coins,
    levelUp,
    nouveauNiveau: levelUp ? nouveauNiveau : null,
    achievementsDebloques: debloques
  }

  // Auto-complétion du parent : si cette tâche est une sous-tâche et qu'il ne
  // reste plus aucune sous-tâche active pour le parent, on termine le parent
  // (effet « projet bouclé ») et on cumule sa récompense.
  const parentId = tache.parent_id as number | null
  if (parentId) {
    // Garde : ne pas re-terminer un parent déjà terminé (sinon double comptage XP).
    const parent = db.prepare('SELECT statut FROM taches WHERE id = ?').get(parentId) as { statut: string } | undefined
    const reste = db.prepare(
      "SELECT COUNT(*) as n FROM taches WHERE parent_id = ? AND statut IN ('active','en_cours')"
    ).get(parentId) as { n: number }
    if (parent && parent.statut !== 'terminee' && reste.n === 0) {
      const parentRes = terminerTache(db, parentId)
      return {
        profil: parentRes.profil,
        xpGagne: resultat.xpGagne + parentRes.xpGagne,
        coinsGagnes: resultat.coinsGagnes + parentRes.coinsGagnes,
        levelUp: resultat.levelUp || parentRes.levelUp,
        nouveauNiveau: parentRes.nouveauNiveau ?? resultat.nouveauNiveau,
        achievementsDebloques: [...resultat.achievementsDebloques, ...parentRes.achievementsDebloques]
      }
    }
  }

  return resultat
}

// Annule l'effet d'une complétion sur le profil : retire XP + coins, décrémente
// le compteur de tâches, et recalcule niveau / xp / xp_prochain à partir de l'XP
// absolu cumulé (robuste, sans soustraction approximative). Borné à 0.
// Note : les achievements déjà débloqués ne sont PAS re-verrouillés (à dessein).
export function annulerCompletion(db: Db, xp: number, coins: number): void {
  const profil = db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>
  const niveau = profil.niveau as number
  // XP absolu = somme des paliers franchis (k*100) + xp courant
  const cumulNiveau = 100 * (niveau - 1) * niveau / 2
  let total = Math.max(0, cumulNiveau + (profil.xp as number) - xp)

  let nNiveau = 1
  let prochain = xpPourNiveau(1) // 100
  while (total >= prochain) {
    total -= prochain
    nNiveau += 1
    prochain = xpPourNiveau(nNiveau)
  }

  const coinsFinal = Math.max(0, (profil.neurocoins as number) - coins)
  const totalTaches = Math.max(0, (profil.total_taches_terminees as number) - 1)

  db.prepare(`
    UPDATE profil SET xp = ?, niveau = ?, xp_prochain_niveau = ?, neurocoins = ?, total_taches_terminees = ? WHERE id = 1
  `).run(total, nNiveau, prochain, coinsFinal, totalTaches)
}

export function ignorerTache(db: Db, id: number): void {
  db.prepare("UPDATE taches SET statut = 'ignoree', est_mission_jour = 0 WHERE id = ?").run(id)
}

export function deleteTache(db: Db, id: number): void {
  db.prepare('DELETE FROM taches WHERE id = ?').run(id)
}

// ─── Sessions Focus ────────────────────────────────────────────────────────────

function sessionToDTO(r: Record<string, unknown>): SessionFocusDTO {
  return {
    id: r.id as number,
    tacheId: (r.tache_id as number | null) ?? null,
    tacheTitre: (r.tache_titre as string | null) ?? null,
    dureePrevueMin: r.duree_prevue_min as number,
    dureeReelleMin: (r.duree_reelle_min as number | null) ?? null,
    completee: Boolean(r.completee),
    debutLe: r.debut_le as string,
    finLe: (r.fin_le as string | null) ?? null
  }
}

export function demarrerSession(db: Db, tacheId: number | null, dureePrevueMin: number): SessionFocusDTO {
  const res = db.prepare(`INSERT INTO sessions_focus (tache_id, duree_prevue_min) VALUES (?, ?)`).run(tacheId, dureePrevueMin)
  if (tacheId) db.prepare("UPDATE taches SET statut = 'en_cours' WHERE id = ?").run(tacheId)
  const r = db.prepare(`
    SELECT s.*, t.titre as tache_titre FROM sessions_focus s LEFT JOIN taches t ON t.id = s.tache_id WHERE s.id = ?
  `).get(res.lastInsertRowid) as Record<string, unknown>
  if (dureePrevueMin <= 2) _debloquerProgressionAchievement(db, 'chrysalide')
  return sessionToDTO(r)
}

export function terminerSession(db: Db, id: number, completee: boolean, dureeReelleMin: number): void {
  db.prepare(`UPDATE sessions_focus SET completee = ?, duree_reelle_min = ?, fin_le = datetime('now','localtime') WHERE id = ?`).run(completee ? 1 : 0, dureeReelleMin, id)
  // Vérifier achievement marathon (30 min focus en un jour)
  const totalMin = (db.prepare("SELECT COALESCE(SUM(duree_reelle_min),0) as t FROM sessions_focus WHERE date(debut_le) = date('now','localtime') AND completee = 1").get() as { t: number }).t
  if (totalMin >= 30) _debloquerAchievement(db, 'marathon')
}

export function listSessionsAujourdHui(db: Db): SessionFocusDTO[] {
  return (db.prepare(`
    SELECT s.*, t.titre as tache_titre FROM sessions_focus s
    LEFT JOIN taches t ON t.id = s.tache_id
    WHERE date(s.debut_le) = date('now','localtime')
    ORDER BY s.debut_le DESC
  `).all() as Record<string, unknown>[]).map(sessionToDTO)
}

// ─── Achievements ─────────────────────────────────────────────────────────────

const _progressionAchievement: Record<string, number> = {}

function _debloquerAchievement(db: Db, id: string): AchievementDTO[] {
  const a = db.prepare('SELECT * FROM achievements WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!a || a.debloque_le) return []
  db.prepare("UPDATE achievements SET debloque_le = datetime('now','localtime') WHERE id = ?").run(id)
  // Note : le xp_bonus est affiché dans l'UI mais n'est PAS ajouté à profil.xp
  // afin de préserver la réversibilité du calcul XP (annulerCompletion).
  return [{ id: a.id as string, titre: a.titre as string, description: a.description as string, icone: a.icone as string, xpBonus: a.xp_bonus as number, debloqueLe: new Date().toISOString() }]
}

function _debloquerProgressionAchievement(db: Db, id: string): void {
  _progressionAchievement[id] = (_progressionAchievement[id] ?? 0) + 1
  if (_progressionAchievement[id] >= 5) _debloquerAchievement(db, id)
}

export function listAchievements(db: Db): AchievementDTO[] {
  return (db.prepare('SELECT * FROM achievements ORDER BY debloque_le DESC NULLS LAST').all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as string, titre: r.titre as string, description: r.description as string, icone: r.icone as string, xpBonus: r.xp_bonus as number, debloqueLe: (r.debloque_le as string | null) ?? null }))
}

// ─── Énergie ──────────────────────────────────────────────────────────────────

export function getEnergieJour(db: Db): EnergieDTO | null {
  const r = db.prepare('SELECT * FROM energie_jour WHERE date_entree = ?').get(today()) as Record<string, unknown> | undefined
  return r ? { date: r.date_entree as string, niveau: r.niveau as NiveauEnergieJour } : null
}

export function setEnergieJour(db: Db, niveau: NiveauEnergieJour): EnergieDTO {
  db.prepare('INSERT INTO energie_jour (date_entree, niveau) VALUES (?, ?) ON CONFLICT(date_entree) DO UPDATE SET niveau = excluded.niveau').run(today(), niveau)
  return { date: today(), niveau }
}

// ─── Captures ────────────────────────────────────────────────────────────────

export function listCaptures(db: Db): CaptureDTO[] {
  return (db.prepare('SELECT * FROM captures WHERE transformee_en_tache = 0 ORDER BY cree_le DESC').all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as number, texte: r.texte as string, transformeeEnTache: Boolean(r.transformee_en_tache), creeLe: r.cree_le as string }))
}

export function addCapture(db: Db, texte: string): CaptureDTO {
  const res = db.prepare('INSERT INTO captures (texte) VALUES (?)').run(texte)
  const total = (db.prepare('SELECT COUNT(*) as n FROM captures').get() as { n: number }).n
  if (total >= 10) _debloquerAchievement(db, 'inventeur')
  return { id: res.lastInsertRowid as number, texte, transformeeEnTache: false, creeLe: new Date().toISOString() }
}

export function transformerCapture(db: Db, id: number, input: Parameters<typeof createTache>[1]): TacheDTO {
  const tache = createTache(db, input)
  db.prepare('UPDATE captures SET transformee_en_tache = 1, tache_id = ? WHERE id = ?').run(tache.id, id)
  return tache
}

export function deleteCapture(db: Db, id: number): void {
  db.prepare('DELETE FROM captures WHERE id = ?').run(id)
}

// ─── Récompenses ──────────────────────────────────────────────────────────────

export function listRecompenses(db: Db): RecompenseDTO[] {
  return (db.prepare('SELECT * FROM recompenses ORDER BY utilisee ASC, cout_coins ASC').all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as number, titre: r.titre as string, coutCoins: r.cout_coins as number, icone: r.icone as string, utilisee: Boolean(r.utilisee) }))
}

export function createRecompense(db: Db, titre: string, coutCoins: number, icone: string): RecompenseDTO {
  const res = db.prepare('INSERT INTO recompenses (titre, cout_coins, icone) VALUES (?, ?, ?)').run(titre, coutCoins, icone)
  return { id: res.lastInsertRowid as number, titre, coutCoins, icone, utilisee: false }
}

export function acheterRecompense(db: Db, id: number): { profil: ProfilDTO; recompense: RecompenseDTO } {
  const r = db.prepare('SELECT * FROM recompenses WHERE id = ?').get(id) as Record<string, unknown>
  const profil = db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>
  if ((profil.neurocoins as number) < (r.cout_coins as number)) throw new Error('Pas assez de NeuroCoins')
  db.prepare('UPDATE profil SET neurocoins = neurocoins - ? WHERE id = 1').run(r.cout_coins)
  db.prepare('UPDATE recompenses SET utilisee = 1 WHERE id = ?').run(id)
  return {
    profil: getProfil(db),
    recompense: { id: r.id as number, titre: r.titre as string, coutCoins: r.cout_coins as number, icone: r.icone as string, utilisee: true }
  }
}

export function deleteRecompense(db: Db, id: number): void {
  db.prepare('DELETE FROM recompenses WHERE id = ?').run(id)
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getStats(db: Db): StatsDTO {
  const auj = (db.prepare("SELECT COUNT(*) as n FROM taches WHERE date(completee_le) = date('now','localtime') AND statut = 'terminee'").get() as { n: number }).n
  const semaine = (db.prepare("SELECT COUNT(*) as n FROM taches WHERE completee_le >= datetime('now','-7 days','localtime') AND statut = 'terminee'").get() as { n: number }).n
  const sessions = (db.prepare("SELECT COUNT(*) as n FROM sessions_focus WHERE date(debut_le) = date('now','localtime')").get() as { n: number }).n
  const minutes = (db.prepare("SELECT COALESCE(SUM(duree_reelle_min),0) as t FROM sessions_focus WHERE date(debut_le) = date('now','localtime') AND completee = 1").get() as { t: number }).t
  const streak = (db.prepare('SELECT streak_jours FROM profil WHERE id = 1').get() as { streak_jours: number }).streak_jours
  return { tachesAujourdHui: auj, tachesTotalSemaine: semaine, sessionsFocusAujourdHui: sessions, minutesFocusAujourdHui: minutes, streakActuel: streak }
}

// ─── Indice de régularité ─────────────────────────────────────────────────────

export function getConsistance(db: Db): ConsistanceDTO {
  // Jours distincts avec au moins une action (tâche terminée OU session focus)
  const datesActives = (db.prepare(`
    SELECT date(completee_le) AS d FROM taches
      WHERE statut = 'terminee' AND completee_le >= date('now','-29 days','localtime')
    UNION
    SELECT date(debut_le) AS d FROM sessions_focus
      WHERE debut_le >= date('now','-29 days','localtime')
  `).all() as { d: string }[])
    .map((r) => r.d)
    .filter(Boolean)

  const setActifs = new Set(datesActives)

  // Construit la grille des 7 derniers jours (index 0 = il y a 6 jours)
  const jours7: boolean[] = []
  let actifs7 = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA') // YYYY-MM-DD en heure locale
    const actif = setActifs.has(key)
    jours7.push(actif)
    if (actif) actifs7++
  }

  return { jours7, actifs7, actifs30: setActifs.size }
}

// ─── Rendez-vous Fantômes ─────────────────────────────────────────────────────

function rendezVousToDTO(r: Record<string, unknown>): RendezVousDTO {
  return {
    id: r.id as number,
    titre: r.titre as string,
    moment: r.moment as string,
    notifie: Boolean(r.notifie)
  }
}

export function listRendezVous(db: Db): RendezVousDTO[] {
  return (db.prepare('SELECT * FROM rendez_vous ORDER BY moment ASC').all() as Record<string, unknown>[]).map(rendezVousToDTO)
}

export function createRendezVous(db: Db, titre: string, moment: string): RendezVousDTO {
  const res = db.prepare('INSERT INTO rendez_vous (titre, moment) VALUES (?, ?)').run(titre, moment)
  return rendezVousToDTO(db.prepare('SELECT * FROM rendez_vous WHERE id = ?').get(res.lastInsertRowid) as Record<string, unknown>)
}

export function cancelRendezVous(db: Db, id: number): void {
  db.prepare('DELETE FROM rendez_vous WHERE id = ?').run(id)
}

// Rendez-vous pas encore notifiés — à (re)planifier au démarrage
export function listRendezVousAPlanifier(db: Db): RendezVousDTO[] {
  return (db.prepare('SELECT * FROM rendez_vous WHERE notifie = 0').all() as Record<string, unknown>[]).map(rendezVousToDTO)
}

export function marquerRendezVousNotifie(db: Db, id: number): void {
  db.prepare('UPDATE rendez_vous SET notifie = 1 WHERE id = ?').run(id)
}

// ─── Mode Journée Sans (bare minimum du jour) ─────────────────────────────────

export function getJourneeSans(db: Db): boolean {
  const r = db.prepare("SELECT 1 FROM journee_sans WHERE date_entree = date('now','localtime')").get()
  return Boolean(r)
}

export function setJourneeSans(db: Db, actif: boolean): boolean {
  if (actif) {
    db.prepare("INSERT OR IGNORE INTO journee_sans (date_entree) VALUES (date('now','localtime'))").run()
  } else {
    db.prepare("DELETE FROM journee_sans WHERE date_entree = date('now','localtime')").run()
  }
  return getJourneeSans(db)
}

// ─── Tâche pivot ──────────────────────────────────────────────────────────────

export function setPivot(db: Db, id: number, estPivot: boolean): TacheDTO {
  if (estPivot) db.prepare("UPDATE taches SET est_pivot = 0 WHERE est_pivot = 1").run()
  db.prepare("UPDATE taches SET est_pivot = ? WHERE id = ?").run(estPivot ? 1 : 0, id)
  return tacheToDTO(db.prepare('SELECT * FROM taches WHERE id = ?').get(id) as Record<string, unknown>)
}

export function getTachePivot(db: Db): TacheDTO | null {
  const r = db.prepare("SELECT * FROM taches WHERE est_pivot = 1 AND statut != 'terminee' LIMIT 1").get() as Record<string, unknown> | undefined
  return r ? tacheToDTO(r) : null
}

// ─── Coaching ─────────────────────────────────────────────────────────────────

export function getAffirmation(db: Db): string | null {
  const r = db.prepare("SELECT texte FROM affirmations WHERE date_entree = date('now','localtime')").get() as { texte: string } | undefined
  return r?.texte ?? null
}

export function setAffirmation(db: Db, texte: string): void {
  db.prepare("INSERT INTO affirmations (date_entree, texte) VALUES (date('now','localtime'), ?) ON CONFLICT(date_entree) DO UPDATE SET texte = excluded.texte").run(texte)
}

export function listVictoires(db: Db): VictoireDTO[] {
  return (db.prepare("SELECT * FROM victoires WHERE date_entree = date('now','localtime') ORDER BY id DESC").all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as number, texte: r.texte as string, dateEntree: r.date_entree as string }))
}

export function addVictoire(db: Db, texte: string): VictoireDTO {
  const res = db.prepare("INSERT INTO victoires (date_entree, texte) VALUES (date('now','localtime'), ?)").run(texte)
  return { id: res.lastInsertRowid as number, texte, dateEntree: today() }
}

export function deleteVictoire(db: Db, id: number): void {
  db.prepare('DELETE FROM victoires WHERE id = ?').run(id)
}

export function getMatrice(db: Db): MatriceItemDTO[] {
  return (db.prepare('SELECT * FROM matrice_controle ORDER BY type, id').all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as number, texte: r.texte as string, type: r.type as 'controle' | 'non_controle' }))
}

export function addMatriceItem(db: Db, texte: string, type: 'controle' | 'non_controle'): MatriceItemDTO {
  const res = db.prepare('INSERT INTO matrice_controle (texte, type) VALUES (?, ?)').run(texte, type)
  return { id: res.lastInsertRowid as number, texte, type }
}

export function deleteMatriceItem(db: Db, id: number): void {
  db.prepare('DELETE FROM matrice_controle WHERE id = ?').run(id)
}

export function listReves(db: Db): ReveDTO[] {
  return (db.prepare('SELECT * FROM sandbox_reves ORDER BY id DESC').all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as number, texte: r.texte as string, actionExtraite: (r.action_extraite as string | null) ?? null, tacheId: (r.tache_id as number | null) ?? null }))
}

export function addReve(db: Db, texte: string): ReveDTO {
  const res = db.prepare('INSERT INTO sandbox_reves (texte) VALUES (?)').run(texte)
  return { id: res.lastInsertRowid as number, texte, actionExtraite: null, tacheId: null }
}

export function extraireAction(db: Db, id: number, action: string): TacheDTO {
  const tache = createTache(db, { titre: action, niveauEnergie: 'faible', dureeEstimeeMin: 15 })
  db.prepare('UPDATE sandbox_reves SET action_extraite = ?, tache_id = ? WHERE id = ?').run(action, tache.id, id)
  return tache
}

export function deleteReve(db: Db, id: number): void {
  db.prepare('DELETE FROM sandbox_reves WHERE id = ?').run(id)
}

export function listCapsules(db: Db): CapsuleDTO[] {
  return (db.prepare('SELECT * FROM capsules_temps ORDER BY date_ouverture ASC').all() as Record<string, unknown>[])
    .map((r) => ({ id: r.id as number, message: r.message as string, dateOuverture: r.date_ouverture as string, ouvert: Boolean(r.ouvert), creeLe: r.cree_le as string }))
}

export function createCapsule(db: Db, message: string, dateOuverture: string): CapsuleDTO {
  const res = db.prepare('INSERT INTO capsules_temps (message, date_ouverture) VALUES (?, ?)').run(message, dateOuverture)
  return { id: res.lastInsertRowid as number, message, dateOuverture, ouvert: false, creeLe: new Date().toISOString() }
}

export function ouvrirCapsule(db: Db, id: number): CapsuleDTO {
  db.prepare('UPDATE capsules_temps SET ouvert = 1 WHERE id = ?').run(id)
  return listCapsules(db).find((c) => c.id === id)!
}

export function getBilanReponses(db: Db): BilanReponseDTO[] {
  return (db.prepare("SELECT * FROM bilan_reponses WHERE date_entree = date('now','localtime')").all() as Record<string, unknown>[])
    .map((r) => ({ questionId: r.question_id as number, reponse: r.reponse as string, dateEntree: r.date_entree as string }))
}

export function setBilanReponse(db: Db, questionId: number, reponse: string): void {
  db.prepare("INSERT INTO bilan_reponses (question_id, reponse, date_entree) VALUES (?, ?, date('now','localtime')) ON CONFLICT(question_id, date_entree) DO UPDATE SET reponse = excluded.reponse").run(questionId, reponse)
}

// ─── Revue hebdomadaire ───────────────────────────────────────────────────────

export function getRevueHebdo(db: Db, semaine: string): RevueHebdoDTO | null {
  const row = db.prepare('SELECT * FROM revue_hebdo WHERE semaine = ?').get(semaine) as {
    id: number; semaine: string; reponses: string; xp_attribue: number; cree_le: string
  } | undefined
  if (!row) return null
  return {
    id: row.id,
    semaine: row.semaine,
    reponses: JSON.parse(row.reponses) as RevueReponse[],
    xpAttribue: row.xp_attribue,
    creeLe: row.cree_le
  }
}

export function saveRevueHebdo(
  db: Db,
  semaine: string,
  reponses: RevueReponse[]
): { revue: RevueHebdoDTO; xpGagne: number } {
  const estNouveauSave = !getRevueHebdo(db, semaine)
  const xpGagne = estNouveauSave ? 100 : 0

  db.prepare(`
    INSERT INTO revue_hebdo (semaine, reponses, xp_attribue)
    VALUES (?, ?, ?)
    ON CONFLICT(semaine) DO UPDATE SET reponses = excluded.reponses
  `).run(semaine, JSON.stringify(reponses), xpGagne)

  if (estNouveauSave) {
    const joueur = db.prepare('SELECT xp FROM profil WHERE id = 1').get() as { xp: number } | undefined
    if (joueur) {
      db.prepare('UPDATE profil SET xp = ? WHERE id = 1').run(joueur.xp + xpGagne)
    }
  }

  return { revue: getRevueHebdo(db, semaine)!, xpGagne }
}
