// Mode Réveil/Coucher — préférences légères (heures, "fait aujourd'hui").
// Stocké en localStorage : ce sont des réglages d'appareil, pas des données métier.

export interface RituelConfig {
  actif: boolean
  reveilDebut: number
  reveilFin: number
  coucherDebut: number
  coucherFin: number
}

export type Phase = 'reveil' | 'coucher'

const KEY = 'neuroboost-rituels'

const DEFAUT: RituelConfig = {
  actif: true,
  reveilDebut: 5,
  reveilFin: 10,
  coucherDebut: 21,
  coucherFin: 24
}

export function getRituelConfig(): RituelConfig {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAUT, ...JSON.parse(raw) } : DEFAUT
  } catch {
    return DEFAUT
  }
}

export function setRituelConfig(c: RituelConfig): void {
  localStorage.setItem(KEY, JSON.stringify(c))
}

// Gère les fenêtres qui passent minuit (ex : 22h → 2h)
function dansFenetre(heure: number, debut: number, fin: number): boolean {
  return debut <= fin ? heure >= debut && heure < fin : heure >= debut || heure < fin
}

export function phaseActuelle(c: RituelConfig, d: Date = new Date()): Phase | null {
  const h = d.getHours()
  if (dansFenetre(h, c.reveilDebut, c.reveilFin)) return 'reveil'
  if (dansFenetre(h, c.coucherDebut, c.coucherFin)) return 'coucher'
  return null
}

function cleJour(phase: Phase, d: Date = new Date()): string {
  return `neuroboost-rituel-${d.toLocaleDateString('en-CA')}-${phase}`
}

export function rituelFaitAujourdhui(phase: Phase): boolean {
  return localStorage.getItem(cleJour(phase)) === '1'
}

export function marquerRituelFait(phase: Phase): void {
  localStorage.setItem(cleJour(phase), '1')
}

// ── Tâches de chaque routine (matin / nuit) ─────────────────────────────────
// Listes éditables par l'utilisateur (ajout/suppression), persistées par appareil.
// On part de listes par défaut puis on stocke la version personnalisée.

const TACHES_DEFAUT: Record<Phase, string[]> = {
  reveil: [
    "💧 Bois un grand verre d'eau",
    '🤸 Étire-toi 2 minutes'
  ],
  coucher: [
    '📵 Range ton téléphone hors de portée',
    '🔅 Tamise les lumières'
  ]
}

const cleTaches = (phase: Phase): string => `neuroboost-rituel-taches-${phase}`

export function getRituelTaches(phase: Phase): string[] {
  try {
    const raw = localStorage.getItem(cleTaches(phase))
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((t): t is string => typeof t === 'string')
    }
  } catch {
    /* localStorage illisible → on retombe sur les valeurs par défaut */
  }
  return [...TACHES_DEFAUT[phase]]
}

export function setRituelTaches(phase: Phase, taches: string[]): void {
  localStorage.setItem(cleTaches(phase), JSON.stringify(taches))
}

// ── Intention du matin & victoire du soir ───────────────────────────────────
// Notes du jour écrites dans les routines et affichées sur l'accueil.
// Une valeur par jour (clé datée), comme le suivi "rituel fait".

export type TypeNote = 'intention' | 'victoire'

function cleNote(type: TypeNote, d: Date = new Date()): string {
  return `neuroboost-note-${type}-${d.toLocaleDateString('en-CA')}`
}

export function getNoteJour(type: TypeNote, d: Date = new Date()): string {
  return localStorage.getItem(cleNote(type, d)) ?? ''
}

export function setNoteJour(type: TypeNote, valeur: string, d: Date = new Date()): void {
  const cle = cleNote(type, d)
  if (valeur.trim()) localStorage.setItem(cle, valeur)
  else localStorage.removeItem(cle)
}

// ── Tâches cochées « fait » du jour ─────────────────────────────────────────
// Les clés sont datées : tout repart naturellement à zéro à minuit.
// `faites` = état coché (peut se décocher) ; `recompensees` = déjà récompensé
// aujourd'hui (jamais retiré) pour empêcher de regagner des points en re-cochant.

function lireListe(cle: string): string[] {
  try {
    const raw = localStorage.getItem(cle)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((t): t is string => typeof t === 'string')
    }
  } catch {
    /* illisible → liste vide */
  }
  return []
}

const cleFaites = (phase: Phase, d = new Date()): string => `neuroboost-rituel-faites-${d.toLocaleDateString('en-CA')}-${phase}`
const cleRecomp = (phase: Phase, d = new Date()): string => `neuroboost-rituel-recomp-${d.toLocaleDateString('en-CA')}-${phase}`

export function getRituelFaites(phase: Phase): string[] {
  return lireListe(cleFaites(phase))
}

export function setRituelFaites(phase: Phase, faites: string[]): void {
  localStorage.setItem(cleFaites(phase), JSON.stringify(faites))
}

export function dejaRecompensee(phase: Phase, texte: string): boolean {
  return lireListe(cleRecomp(phase)).includes(texte)
}

export function marquerRecompensee(phase: Phase, texte: string): void {
  const s = lireListe(cleRecomp(phase))
  if (!s.includes(texte)) {
    s.push(texte)
    localStorage.setItem(cleRecomp(phase), JSON.stringify(s))
  }
}
