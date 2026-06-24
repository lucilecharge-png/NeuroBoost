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
  completedLe: string | null
  creeLe: string
}

export interface TacheInput {
  titre: string
  description?: string | null
  niveauEnergie?: NiveauEnergie
  dureeEstimeeMin?: number
  categorie?: string | null
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

// ─── Résultat de complétion ───────────────────────────────────────────────────

export interface CompletionResult {
  profil: ProfilDTO
  xpGagne: number
  coinsGagnes: number
  levelUp: boolean
  nouveauNiveau: number | null
  achievementsDebloques: AchievementDTO[]
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

  // Focus
  demarrerSession: (tacheId: number | null, dureePrevueMin: number) => Promise<SessionFocusDTO>
  terminerSession: (id: number, completee: boolean, dureeReelleMin: number) => Promise<void>
  listSessionsAujourdHui: () => Promise<SessionFocusDTO[]>

  // Achievements
  listAchievements: () => Promise<AchievementDTO[]>

  // Énergie
  getEnergieJour: () => Promise<EnergieDTO | null>
  setEnergieJour: (niveau: NiveauEnergieJour) => Promise<EnergieDTO>

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
}

// ─── Types coaching ───────────────────────────────────────────────────────────

export interface VictoireDTO { id: number; texte: string; dateEntree: string }
export interface MatriceItemDTO { id: number; texte: string; type: 'controle' | 'non_controle' }
export interface ReveDTO { id: number; texte: string; actionExtraite: string | null; tacheId: number | null }
export interface CapsuleDTO { id: number; message: string; dateOuverture: string; ouvert: boolean; creeLe: string }
export interface BilanReponseDTO { questionId: number; reponse: string; dateEntree: string }
