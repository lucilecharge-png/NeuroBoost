// Implémentation navigateur de NeuroBoostApi : remplace l'IPC Electron + preload.
// Toutes les méthodes appellent la logique de jeu (game.ts) sur la DB sql.js,
// puis une persistance différée écrit la base dans IndexedDB.
import type { NeuroBoostApi, RendezVousDTO, SousTacheProposee } from '../../../shared/types'
import * as G from './game'
import { initDb, schedulePersist, persist, type Db } from './db'

let db: Db

// ─── Rendez-vous Fantômes : notifications navigateur ──────────────────────────

const timers = new Map<number, ReturnType<typeof setTimeout>>()
const MAX_DELAY = 2 ** 31 - 1

function declencher(rv: RendezVousDTO): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🔔 Rendez-vous avec toi-même', { body: rv.titre })
  }
  G.marquerRendezVousNotifie(db, rv.id)
  schedulePersist()
  timers.delete(rv.id)
}

function planifier(rv: RendezVousDTO): void {
  annuler(rv.id)
  if (rv.notifie) return
  const cible = new Date(rv.moment.replace(' ', 'T')).getTime()
  if (Number.isNaN(cible)) return
  const delai = cible - Date.now()
  if (delai <= 0) {
    declencher(rv)
    return
  }
  if (delai > MAX_DELAY) return
  timers.set(rv.id, setTimeout(() => declencher(rv), delai))
}

function annuler(id: number): void {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

const rawApi: NeuroBoostApi = {
  // Profil
  getProfil: async () => G.getProfil(db),
  setPseudo: async (pseudo) => G.setPseudo(db, pseudo),
  setAvatarEmoji: async () => G.getProfil(db), // avatar dérivé du niveau — no-op
  connexionJournaliere: async () => G.connexionJournaliere(db),

  // Tâches
  getMissionsJour: async () => G.getMissionsJour(db),
  listTaches: async (filtres) => G.listTaches(db, filtres),
  createTache: async (input) => G.createTache(db, input),
  updateTache: async (id, input) => G.updateTache(db, id, input),
  deleteTache: async (id) => {
    G.deleteTache(db, id)
  },
  demarrerTache: async (id) => G.demarrerTache(db, id),
  terminerTache: async (id, duree) => G.terminerTache(db, id, duree),
  ignorerTache: async (id) => {
    G.ignorerTache(db, id)
  },
  regenererMissions: async () => G.regenererMissions(db),

  // Découpe en sous-tâches
  decouperTache: async (input, nombre) => {
    const resp = await fetch('/api/decoupe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, nombre })
    })
    if (!resp.ok) throw new Error(`decoupe ${resp.status}`)
    const data = (await resp.json()) as { sousTaches?: SousTacheProposee[] }
    return data.sousTaches ?? []
  },
  creerSousTaches: async (parentId, sousTaches) => G.creerSousTaches(db, parentId, sousTaches),

  // Focus
  demarrerSession: async (tacheId, duree) => G.demarrerSession(db, tacheId, duree),
  terminerSession: async (id, completee, duree) => {
    G.terminerSession(db, id, completee, duree)
  },
  listSessionsAujourdHui: async () => G.listSessionsAujourdHui(db),

  // Achievements
  listAchievements: async () => G.listAchievements(db),

  // Énergie
  getEnergieJour: async () => G.getEnergieJour(db),
  setEnergieJour: async (niveau) => G.setEnergieJour(db, niveau),

  // Mode Journée Sans
  getJourneeSans: async () => G.getJourneeSans(db),
  setJourneeSans: async (actif) => G.setJourneeSans(db, actif),

  // Rendez-vous Fantômes
  listRendezVous: async () => G.listRendezVous(db),
  createRendezVous: async (titre, moment) => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
    const rv = G.createRendezVous(db, titre, moment)
    planifier(rv)
    return rv
  },
  cancelRendezVous: async (id) => {
    annuler(id)
    G.cancelRendezVous(db, id)
  },

  // Captures
  listCaptures: async () => G.listCaptures(db),
  addCapture: async (texte) => G.addCapture(db, texte),
  transformerCapture: async (id, input) => G.transformerCapture(db, id, input),
  deleteCapture: async (id) => {
    G.deleteCapture(db, id)
  },

  // Récompenses
  listRecompenses: async () => G.listRecompenses(db),
  createRecompense: async (titre, cout, icone) => G.createRecompense(db, titre, cout, icone),
  acheterRecompense: async (id) => G.acheterRecompense(db, id),
  deleteRecompense: async (id) => {
    G.deleteRecompense(db, id)
  },

  // Stats
  getStats: async () => G.getStats(db),
  getConsistance: async () => G.getConsistance(db),

  // Pivot
  setPivot: async (id, estPivot) => G.setPivot(db, id, estPivot),
  getTachePivot: async () => G.getTachePivot(db),

  // Coaching
  getAffirmation: async () => G.getAffirmation(db),
  setAffirmation: async (texte) => {
    G.setAffirmation(db, texte)
  },
  listVictoires: async () => G.listVictoires(db),
  addVictoire: async (texte) => G.addVictoire(db, texte),
  deleteVictoire: async (id) => {
    G.deleteVictoire(db, id)
  },
  getMatrice: async () => G.getMatrice(db),
  addMatriceItem: async (texte, type) => G.addMatriceItem(db, texte, type),
  deleteMatriceItem: async (id) => {
    G.deleteMatriceItem(db, id)
  },
  listReves: async () => G.listReves(db),
  addReve: async (texte) => G.addReve(db, texte),
  extraireAction: async (id, action) => G.extraireAction(db, id, action),
  deleteReve: async (id) => {
    G.deleteReve(db, id)
  },
  listCapsules: async () => G.listCapsules(db),
  createCapsule: async (message, date) => G.createCapsule(db, message, date),
  ouvrirCapsule: async (id) => G.ouvrirCapsule(db, id),
  getBilanReponses: async () => G.getBilanReponses(db),
  setBilanReponse: async (qId, rep) => {
    G.setBilanReponse(db, qId, rep)
  },

  // Revue hebdomadaire
  getRevueHebdo: async (semaine) => G.getRevueHebdo(db, semaine),
  saveRevueHebdo: async (semaine, reponses) => G.saveRevueHebdo(db, semaine, reponses)
}

// Persiste après chaque appel (différé/coalescé — voir schedulePersist).
const api = new Proxy(rawApi, {
  get(target, prop: string) {
    const value = (target as unknown as Record<string, unknown>)[prop]
    if (typeof value !== 'function') return value
    return (...args: unknown[]) => {
      const result = (value as (...a: unknown[]) => unknown)(...args)
      schedulePersist()
      return result
    }
  }
}) as NeuroBoostApi

export async function initApi(): Promise<void> {
  db = await initDb()
  // Replanifie les rendez-vous non encore notifiés
  for (const rv of G.listRendezVousAPlanifier(db)) planifier(rv)
  await persist()
  window.api = api
}
