import { contextBridge, ipcRenderer } from 'electron'
import type { NeuroBoostApi } from '../shared/types'

const api: NeuroBoostApi = {
  getProfil: () => ipcRenderer.invoke('profil:get'),
  setPseudo: (pseudo) => ipcRenderer.invoke('profil:setPseudo', pseudo),
  setAvatarEmoji: (emoji) => ipcRenderer.invoke('profil:setAvatarEmoji', emoji),
  connexionJournaliere: () => ipcRenderer.invoke('profil:connexionJournaliere'),

  getMissionsJour: () => ipcRenderer.invoke('taches:getMissionsJour'),
  listTaches: (filtres) => ipcRenderer.invoke('taches:list', filtres),
  createTache: (input) => ipcRenderer.invoke('taches:create', input),
  updateTache: (id, input) => ipcRenderer.invoke('taches:update', id, input),
  deleteTache: (id) => ipcRenderer.invoke('taches:delete', id),
  demarrerTache: (id) => ipcRenderer.invoke('taches:demarrer', id),
  terminerTache: (id, duree) => ipcRenderer.invoke('taches:terminer', id, duree),
  ignorerTache: (id) => ipcRenderer.invoke('taches:ignorer', id),
  regenererMissions: () => ipcRenderer.invoke('taches:regenererMissions'),

  demarrerSession: (tacheId, duree) => ipcRenderer.invoke('focus:demarrerSession', tacheId, duree),
  terminerSession: (id, completee, duree) => ipcRenderer.invoke('focus:terminerSession', id, completee, duree),
  listSessionsAujourdHui: () => ipcRenderer.invoke('focus:listSessionsAujourdHui'),

  listAchievements: () => ipcRenderer.invoke('achievements:list'),

  getEnergieJour: () => ipcRenderer.invoke('energie:get'),
  setEnergieJour: (niveau) => ipcRenderer.invoke('energie:set', niveau),

  listCaptures: () => ipcRenderer.invoke('captures:list'),
  addCapture: (texte) => ipcRenderer.invoke('captures:add', texte),
  transformerCapture: (id, input) => ipcRenderer.invoke('captures:transformer', id, input),
  deleteCapture: (id) => ipcRenderer.invoke('captures:delete', id),

  listRecompenses: () => ipcRenderer.invoke('recompenses:list'),
  createRecompense: (titre, cout, icone) => ipcRenderer.invoke('recompenses:create', titre, cout, icone),
  acheterRecompense: (id) => ipcRenderer.invoke('recompenses:acheter', id),
  deleteRecompense: (id) => ipcRenderer.invoke('recompenses:delete', id),

  getStats: () => ipcRenderer.invoke('stats:get'),

  setPivot: (id, estPivot) => ipcRenderer.invoke('taches:setPivot', id, estPivot),
  getTachePivot: () => ipcRenderer.invoke('taches:getPivot'),

  getAffirmation: () => ipcRenderer.invoke('coaching:getAffirmation'),
  setAffirmation: (texte) => ipcRenderer.invoke('coaching:setAffirmation', texte),
  listVictoires: () => ipcRenderer.invoke('coaching:listVictoires'),
  addVictoire: (texte) => ipcRenderer.invoke('coaching:addVictoire', texte),
  deleteVictoire: (id) => ipcRenderer.invoke('coaching:deleteVictoire', id),
  getMatrice: () => ipcRenderer.invoke('coaching:getMatrice'),
  addMatriceItem: (texte, type) => ipcRenderer.invoke('coaching:addMatriceItem', texte, type),
  deleteMatriceItem: (id) => ipcRenderer.invoke('coaching:deleteMatriceItem', id),
  listReves: () => ipcRenderer.invoke('coaching:listReves'),
  addReve: (texte) => ipcRenderer.invoke('coaching:addReve', texte),
  extraireAction: (id, action) => ipcRenderer.invoke('coaching:extraireAction', id, action),
  deleteReve: (id) => ipcRenderer.invoke('coaching:deleteReve', id),
  listCapsules: () => ipcRenderer.invoke('coaching:listCapsules'),
  createCapsule: (message, date) => ipcRenderer.invoke('coaching:createCapsule', message, date),
  ouvrirCapsule: (id) => ipcRenderer.invoke('coaching:ouvrirCapsule', id),
  getBilanReponses: () => ipcRenderer.invoke('coaching:getBilan'),
  setBilanReponse: (qId, rep) => ipcRenderer.invoke('coaching:setBilan', qId, rep)
}

contextBridge.exposeInMainWorld('api', api)
