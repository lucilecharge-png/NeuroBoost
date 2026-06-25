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
