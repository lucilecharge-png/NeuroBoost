import { ipcMain } from 'electron'
import type { Db } from './db/index'
import * as G from './db/game'
import type { TacheInput, NiveauEnergie, StatutTache, NiveauEnergieJour, RevueReponse } from '../shared/types'

export function registerIpcHandlers(db: Db): void {
  // Profil
  ipcMain.handle('profil:get', () => G.getProfil(db))
  ipcMain.handle('profil:setPseudo', (_e, pseudo: string) => G.setPseudo(db, pseudo))
  ipcMain.handle('profil:connexionJournaliere', () => G.connexionJournaliere(db))

  // Tâches
  ipcMain.handle('taches:getMissionsJour', () => G.getMissionsJour(db))
  ipcMain.handle('taches:list', (_e, filtres?: { statut?: StatutTache; energie?: NiveauEnergie }) => G.listTaches(db, filtres))
  ipcMain.handle('taches:create', (_e, input: TacheInput) => G.createTache(db, input))
  ipcMain.handle('taches:update', (_e, id: number, input: Partial<TacheInput>) => G.updateTache(db, id, input))
  ipcMain.handle('taches:delete', (_e, id: number) => G.deleteTache(db, id))
  ipcMain.handle('taches:demarrer', (_e, id: number) => G.demarrerTache(db, id))
  ipcMain.handle('taches:terminer', (_e, id: number, dureeReelleMin?: number) => G.terminerTache(db, id, dureeReelleMin))
  ipcMain.handle('taches:ignorer', (_e, id: number) => G.ignorerTache(db, id))
  ipcMain.handle('taches:regenererMissions', () => G.regenererMissions(db))

  // Focus
  ipcMain.handle('focus:demarrerSession', (_e, tacheId: number | null, dureePrevueMin: number) => G.demarrerSession(db, tacheId, dureePrevueMin))
  ipcMain.handle('focus:terminerSession', (_e, id: number, completee: boolean, dureeReelleMin: number) => G.terminerSession(db, id, completee, dureeReelleMin))
  ipcMain.handle('focus:listSessionsAujourdHui', () => G.listSessionsAujourdHui(db))

  // Achievements
  ipcMain.handle('achievements:list', () => G.listAchievements(db))

  // Énergie
  ipcMain.handle('energie:get', () => G.getEnergieJour(db))
  ipcMain.handle('energie:set', (_e, niveau: NiveauEnergieJour) => G.setEnergieJour(db, niveau))

  // Captures
  ipcMain.handle('captures:list', () => G.listCaptures(db))
  ipcMain.handle('captures:add', (_e, texte: string) => G.addCapture(db, texte))
  ipcMain.handle('captures:transformer', (_e, id: number, input: TacheInput) => G.transformerCapture(db, id, input))
  ipcMain.handle('captures:delete', (_e, id: number) => G.deleteCapture(db, id))

  // Récompenses
  ipcMain.handle('recompenses:list', () => G.listRecompenses(db))
  ipcMain.handle('recompenses:create', (_e, titre: string, coutCoins: number, icone: string) => G.createRecompense(db, titre, coutCoins, icone))
  ipcMain.handle('recompenses:acheter', (_e, id: number) => G.acheterRecompense(db, id))
  ipcMain.handle('recompenses:delete', (_e, id: number) => G.deleteRecompense(db, id))

  // Stats
  ipcMain.handle('stats:get', () => G.getStats(db))

  // Pivot
  ipcMain.handle('taches:setPivot', (_e, id: number, estPivot: boolean) => G.setPivot(db, id, estPivot))
  ipcMain.handle('taches:getPivot', () => G.getTachePivot(db))

  // Coaching
  ipcMain.handle('coaching:getAffirmation', () => G.getAffirmation(db))
  ipcMain.handle('coaching:setAffirmation', (_e, texte: string) => G.setAffirmation(db, texte))
  ipcMain.handle('coaching:listVictoires', () => G.listVictoires(db))
  ipcMain.handle('coaching:addVictoire', (_e, texte: string) => G.addVictoire(db, texte))
  ipcMain.handle('coaching:deleteVictoire', (_e, id: number) => G.deleteVictoire(db, id))
  ipcMain.handle('coaching:getMatrice', () => G.getMatrice(db))
  ipcMain.handle('coaching:addMatriceItem', (_e, texte: string, type: string) => G.addMatriceItem(db, texte, type as 'controle' | 'non_controle'))
  ipcMain.handle('coaching:deleteMatriceItem', (_e, id: number) => G.deleteMatriceItem(db, id))
  ipcMain.handle('coaching:listReves', () => G.listReves(db))
  ipcMain.handle('coaching:addReve', (_e, texte: string) => G.addReve(db, texte))
  ipcMain.handle('coaching:extraireAction', (_e, id: number, action: string) => G.extraireAction(db, id, action))
  ipcMain.handle('coaching:deleteReve', (_e, id: number) => G.deleteReve(db, id))
  ipcMain.handle('coaching:listCapsules', () => G.listCapsules(db))
  ipcMain.handle('coaching:createCapsule', (_e, message: string, date: string) => G.createCapsule(db, message, date))
  ipcMain.handle('coaching:ouvrirCapsule', (_e, id: number) => G.ouvrirCapsule(db, id))
  ipcMain.handle('coaching:getBilan', () => G.getBilanReponses(db))
  ipcMain.handle('coaching:setBilan', (_e, questionId: number, reponse: string) => G.setBilanReponse(db, questionId, reponse))

  // Revue hebdomadaire
  ipcMain.handle('revue:get', (_e, semaine: string) => G.getRevueHebdo(db, semaine))
  ipcMain.handle('revue:save', (_e, semaine: string, reponses: RevueReponse[]) => G.saveRevueHebdo(db, semaine, reponses))
}
