// ─── Profil joueur ───────────────────────────────────────────────────────────

export interface ProfilDTO {
  pseudo: string
  niveau: number
  xp: number
  xpProchainNiveau: number
  neurocoins: number
  streakJours: number
  derniereConnexion: string | null
  avatarEmoji: string
  totalTachesTerminees: number
}

// ─── Tâches / Quêtes ─────────────────────────────────────────────────────────

export type NiveauEnergie = 'micro' | 'faible' | 'moyenne' | 'haute'
export type StatutTache = 'active' | 'en_cours' | 'terminee' | 'ignoree'

export interface TacheDTO {
  id: number
  titre: string
  description: string | null
  niveauEnergie: NiveauEnergie
  dureeEstimeeMin: number
  xpRecompense: number
  coinsRecompense: number
  statut: StatutTache
  categorie: string | null
  estMissionJour: boolean
  estPivot: boolean
  pourquoi: string | null
  completedLe: string | null
  creeLe: string
  parentId: number | null
}

export interface TacheInput {
  titre: string
  description?: string | null
  niveauEnergie?: NiveauEnergie
  dureeEstimeeMin?: number
  categorie?: string | null
  pourquoi?: string | null
}

export interface SousTacheProposee {
  titre: string
  dureeEstimeeMin?: number
  niveauEnergie?: NiveauEnergie
}

// ─── Sessions Focus ───────────────────────────────────────────────────────────

export interface SessionFocusDTO {
  id: number
  tacheId: number | null
  tacheTitre: string | null
  dureePrevueMin: number
  dureeReelleMin: number | null
  completee: boolean
  debutLe: string
  finLe: string | null
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export interface AchievementDTO {
  id: string
  titre: string
  description: string
  icone: string
  xpBonus: number
  debloqueLe: string | null // null = pas encore obtenu
}

// ─── Énergie quotidienne ──────────────────────────────────────────────────────

export type NiveauEnergieJour = 1 | 2 | 3 | 4 | 5

export interface EnergieDTO {
  date: string
  niveau: NiveauEnergieJour
}

// ─── Captures rapides ─────────────────────────────────────────────────────────

export interface CaptureDTO {
  id: number
  texte: string
  transformeeEnTache: boolean
  creeLe: string
}

// ─── Récompenses personnalisées ───────────────────────────────────────────────

export interface RecompenseDTO {
  id: number
  titre: string
  coutCoins: number
  icone: string
  utilisee: boolean
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface StatsDTO {
  tachesAujourdHui: number
  tachesTotalSemaine: number
  sessionsFocusAujourdHui: number
  minutesFocusAujourdHui: number
  streakActuel: number
}

// ─── Rendez-vous Fantômes ─────────────────────────────────────────────────────

export interface RendezVousDTO {
  id: number
  titre: string
  moment: string // 'YYYY-MM-DD HH:MM' en heure locale
  notifie: boolean
}

// ─── Indice de régularité ─────────────────────────────────────────────────────

export interface ConsistanceDTO {
  jours7: boolean[] // 7 jours glissants, index 0 = il y a 6 jours … index 6 = aujourd'hui
  actifs7: number
  actifs30: number
}

// ─── Résultat de complétion ───────────────────────────────────────────────────

export interface CompletionResult {
  profil: ProfilDTO
  xpGagne: number
  coinsGagnes: number
  levelUp: boolean
  nouveauNiveau: number | null
  achievementsDebloques: AchievementDTO[]
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

export type JourSemaine = 'LU' | 'MA' | 'ME' | 'JE' | 'VE' | 'SA' | 'DI'
export type FreqRecurrence = 'quotidien' | 'hebdo' | 'mensuel' | 'annuel'

export interface RecurrenceRule {
  freq: FreqRecurrence
  intervalle: number // >= 1
  jours?: JourSemaine[] // hebdo uniquement
  fin?: { type: 'date'; date: string } | { type: 'count'; count: number }
}

export interface CategorieDTO {
  id: number
  nom: string
  couleur: string
  emoji: string | null
  estSysteme: boolean
}

export interface EvenementInput {
  titre: string
  debut: string // 'YYYY-MM-DD HH:MM'
  fin: string
  allDay?: boolean
  categorieId?: number | null
  description?: string | null
  tacheId?: number | null
  recurrence?: RecurrenceRule | null
  rappelMin?: number | null
}

// Le « maître » tel que stocké
export interface EvenementDTO {
  id: number
  titre: string
  debut: string
  fin: string
  allDay: boolean
  categorieId: number | null
  description: string | null
  tacheId: number | null
  recurrence: RecurrenceRule | null
  rappelMin: number | null
}

// Une occurrence aplatie (ce que consomment les vues)
export interface OccurrenceDTO {
  masterId: number
  dateOccurrence: string // 'YYYY-MM-DD' de l'occurrence
  titre: string
  debut: string // 'YYYY-MM-DD HH:MM' de CETTE occurrence
  fin: string
  allDay: boolean
  categorie: CategorieDTO | null
  description: string | null
  tacheId: number | null
  estRecurrent: boolean
  rappelMin: number | null
}

export type ModeRecurrence = 'occurrence' | 'suivantes' | 'serie'

export interface RappelOccurrence {
  masterId: number
  dateOccurrence: string
  titre: string
  debut: string
  rappelMin: number
}

// ─── API IPC ─────────────────────────────────────────────────────────────────

export interface NeuroBoostApi {
  // Profil
  getProfil: () => Promise<ProfilDTO>
  setPseudo: (pseudo: string) => Promise<ProfilDTO>
  setAvatarEmoji: (emoji: string) => Promise<ProfilDTO>
  connexionJournaliere: () => Promise<{ profil: ProfilDTO; streakBonus: number }>

  // Tâches
  getMissionsJour: () => Promise<TacheDTO[]>
  listTaches: (filtres?: { statut?: StatutTache; energie?: NiveauEnergie }) => Promise<TacheDTO[]>
  createTache: (input: TacheInput) => Promise<TacheDTO>
  updateTache: (id: number, input: Partial<TacheInput>) => Promise<TacheDTO>
  deleteTache: (id: number) => Promise<void>
  demarrerTache: (id: number) => Promise<TacheDTO>
  terminerTache: (id: number, dureeReelleMin?: number) => Promise<CompletionResult>
  ignorerTache: (id: number) => Promise<void>
  regenererMissions: () => Promise<TacheDTO[]>

  // Découpe en sous-tâches
  decouperTache: (
    input: { titre: string; description?: string | null; pourquoi?: string | null; categorie?: string | null },
    nombre: number
  ) => Promise<SousTacheProposee[]>
  creerSousTaches: (parentId: number, sousTaches: TacheInput[]) => Promise<TacheDTO[]>

  // Focus
  demarrerSession: (tacheId: number | null, dureePrevueMin: number) => Promise<SessionFocusDTO>
  terminerSession: (id: number, completee: boolean, dureeReelleMin: number) => Promise<void>
  listSessionsAujourdHui: () => Promise<SessionFocusDTO[]>

  // Achievements
  listAchievements: () => Promise<AchievementDTO[]>

  // Énergie
  getEnergieJour: () => Promise<EnergieDTO | null>
  setEnergieJour: (niveau: NiveauEnergieJour) => Promise<EnergieDTO>

  // Mode Journée Sans (bare minimum du jour)
  getJourneeSans: () => Promise<boolean>
  setJourneeSans: (actif: boolean) => Promise<boolean>

  // Rendez-vous Fantômes
  listRendezVous: () => Promise<RendezVousDTO[]>
  createRendezVous: (titre: string, moment: string) => Promise<RendezVousDTO>
  cancelRendezVous: (id: number) => Promise<void>

  // Captures
  listCaptures: () => Promise<CaptureDTO[]>
  addCapture: (texte: string) => Promise<CaptureDTO>
  transformerCapture: (id: number, tacheInput: TacheInput) => Promise<TacheDTO>
  deleteCapture: (id: number) => Promise<void>

  // Récompenses
  listRecompenses: () => Promise<RecompenseDTO[]>
  createRecompense: (titre: string, coutCoins: number, icone: string) => Promise<RecompenseDTO>
  acheterRecompense: (id: number) => Promise<{ profil: ProfilDTO; recompense: RecompenseDTO }>
  deleteRecompense: (id: number) => Promise<void>

  // Stats
  getStats: () => Promise<StatsDTO>
  getConsistance: () => Promise<ConsistanceDTO>

  // Tâche pivot
  setPivot: (id: number, estPivot: boolean) => Promise<TacheDTO>
  getTachePivot: () => Promise<TacheDTO | null>

  // Coaching
  getAffirmation: () => Promise<string | null>
  setAffirmation: (texte: string) => Promise<void>
  listVictoires: () => Promise<VictoireDTO[]>
  addVictoire: (texte: string) => Promise<VictoireDTO>
  deleteVictoire: (id: number) => Promise<void>
  getMatrice: () => Promise<MatriceItemDTO[]>
  addMatriceItem: (texte: string, type: 'controle' | 'non_controle') => Promise<MatriceItemDTO>
  deleteMatriceItem: (id: number) => Promise<void>
  listReves: () => Promise<ReveDTO[]>
  addReve: (texte: string) => Promise<ReveDTO>
  extraireAction: (id: number, action: string) => Promise<TacheDTO>
  deleteReve: (id: number) => Promise<void>
  listCapsules: () => Promise<CapsuleDTO[]>
  createCapsule: (message: string, dateOuverture: string) => Promise<CapsuleDTO>
  ouvrirCapsule: (id: number) => Promise<CapsuleDTO>
  getBilanReponses: () => Promise<BilanReponseDTO[]>
  setBilanReponse: (questionId: number, reponse: string) => Promise<void>

  // Revue hebdomadaire
  getRevueHebdo: (semaine: string) => Promise<RevueHebdoDTO | null>
  saveRevueHebdo: (semaine: string, reponses: RevueReponse[]) => Promise<{ revue: RevueHebdoDTO; xpGagne: number }>

  // Agenda
  listCategories: () => Promise<CategorieDTO[]>
  createCategorie: (nom: string, couleur: string, emoji: string | null) => Promise<CategorieDTO>
  deleteCategorie: (id: number) => Promise<void>
  listEvenements: (debut: string, fin: string) => Promise<OccurrenceDTO[]>
  createEvenement: (input: EvenementInput) => Promise<EvenementDTO>
  updateEvenement: (masterId: number, dateOccurrence: string, mode: ModeRecurrence, input: Partial<EvenementInput>) => Promise<void>
  deleteEvenement: (masterId: number, dateOccurrence: string, mode: ModeRecurrence) => Promise<void>
}

// ─── Types coaching ───────────────────────────────────────────────────────────

export interface VictoireDTO { id: number; texte: string; dateEntree: string }
export interface MatriceItemDTO { id: number; texte: string; type: 'controle' | 'non_controle' }
export interface ReveDTO { id: number; texte: string; actionExtraite: string | null; tacheId: number | null }
export interface CapsuleDTO { id: number; message: string; dateOuverture: string; ouvert: boolean; creeLe: string }
export interface BilanReponseDTO { questionId: number; reponse: string; dateEntree: string }

// ─── Revue hebdomadaire ───────────────────────────────────────────────────────

export interface RevueReponse {
  questionId: number
  reponse: string
}

export interface RevueHebdoDTO {
  id: number
  semaine: string
  reponses: RevueReponse[]
  xpAttribue: number
  creeLe: string
}
