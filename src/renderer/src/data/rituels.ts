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
    '🌬️ Respire profondément 5 fois',
    '🤸 Étire-toi 2 minutes',
    "✍️ Écris une seule intention pour aujourd'hui"
  ],
  coucher: [
    '📵 Range ton téléphone hors de portée',
    '🌬️ Respire lentement, 5 cycles',
    '🏆 Pense à une victoire de ta journée',
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
