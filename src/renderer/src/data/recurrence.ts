// Conversion RecurrenceRule <-> RRULE (sous-ensemble RFC 5545 compatible Google
// Calendar) + expansion d'occurrences. Fonctions pures, sans accès DB.
import type { RecurrenceRule, FreqRecurrence, JourSemaine } from '../../../shared/types'

const FREQ_VERS_RRULE: Record<FreqRecurrence, string> = {
  quotidien: 'DAILY',
  hebdo: 'WEEKLY',
  mensuel: 'MONTHLY',
  annuel: 'YEARLY'
}
const RRULE_VERS_FREQ: Record<string, FreqRecurrence> = {
  DAILY: 'quotidien',
  WEEKLY: 'hebdo',
  MONTHLY: 'mensuel',
  YEARLY: 'annuel'
}
const JOUR_VERS_RRULE: Record<JourSemaine, string> = {
  LU: 'MO', MA: 'TU', ME: 'WE', JE: 'TH', VE: 'FR', SA: 'SA', DI: 'SU'
}
const RRULE_VERS_JOUR: Record<string, JourSemaine> = {
  MO: 'LU', TU: 'MA', WE: 'ME', TH: 'JE', FR: 'VE', SA: 'SA', SU: 'DI'
}

export function serialiserRRULE(rule: RecurrenceRule): string {
  const parts = [`FREQ=${FREQ_VERS_RRULE[rule.freq]}`]
  if (rule.intervalle > 1) parts.push(`INTERVAL=${rule.intervalle}`)
  if (rule.jours && rule.jours.length > 0) {
    parts.push(`BYDAY=${rule.jours.map((j) => JOUR_VERS_RRULE[j]).join(',')}`)
  }
  if (rule.fin?.type === 'date') parts.push(`UNTIL=${rule.fin.date.replace(/-/g, '')}`)
  else if (rule.fin?.type === 'count') parts.push(`COUNT=${rule.fin.count}`)
  return parts.join(';')
}

export function parserRRULE(s: string): RecurrenceRule {
  const map = new Map<string, string>()
  for (const part of s.split(';')) {
    const [k, v] = part.split('=')
    if (k && v) map.set(k, v)
  }
  const rule: RecurrenceRule = {
    freq: RRULE_VERS_FREQ[map.get('FREQ') ?? 'DAILY'] ?? 'quotidien',
    intervalle: map.has('INTERVAL') ? Number(map.get('INTERVAL')) : 1
  }
  const byday = map.get('BYDAY')
  if (byday) rule.jours = byday.split(',').map((d) => RRULE_VERS_JOUR[d]).filter(Boolean) as JourSemaine[]
  const until = map.get('UNTIL')
  const count = map.get('COUNT')
  if (until) {
    const d = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
    rule.fin = { type: 'date', date: d }
  } else if (count) {
    rule.fin = { type: 'count', count: Number(count) }
  }
  return rule
}

// ─── Helpers de date (heure locale, sans dépendance) ──────────────────────────

const ORDRE_JOURS: JourSemaine[] = ['DI', 'LU', 'MA', 'ME', 'JE', 'VE', 'SA'] // index = getDay()

function p2(n: number): string {
  return n.toString().padStart(2, '0')
}

// 'YYYY-MM-DD HH:MM' -> Date locale
function parseDateTime(s: string): Date {
  const [d, t] = s.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = (t ?? '00:00').split(':').map(Number)
  return new Date(y, mo - 1, da, h, mi, 0, 0)
}

function fmtDateTime(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

// Compare uniquement la partie date (YYYY-MM-DD) de deux Date locales
function jour(d: Date): string {
  return fmtDate(d)
}

// Renvoie les débuts d'occurrences (chaînes 'YYYY-MM-DD HH:MM') dont le JOUR est
// dans [fenetreDebut, fenetreFin] (inclusif). Garde-fou: 5000 itérations max.
export function expanseRecurrence(
  rule: RecurrenceRule,
  debutMaitre: string,
  fenetreDebut: string,
  fenetreFin: string
): string[] {
  const depart = parseDateTime(debutMaitre)
  const heures = depart.getHours()
  const minutes = depart.getMinutes()
  const untilJour = rule.fin?.type === 'date' ? rule.fin.date : null
  const maxCount = rule.fin?.type === 'count' ? rule.fin.count : Infinity

  const resultats: string[] = []
  let nbGeneres = 0 // compteur global pour COUNT (depuis le maître)
  const GARDE = 5000

  const candidats: Date[] = []
  const ajoute = (d: Date): void => {
    const copy = new Date(d)
    copy.setHours(heures, minutes, 0, 0)
    candidats.push(copy)
  }

  if (rule.freq === 'hebdo' && rule.jours && rule.jours.length > 0) {
    const joursVoulus = new Set(rule.jours)
    const curseur = new Date(depart)
    curseur.setHours(0, 0, 0, 0)
    const decalLundi = (curseur.getDay() + 6) % 7 // 0 = lundi
    curseur.setDate(curseur.getDate() - decalLundi)
    let semaines = 0
    while (candidats.length < GARDE) {
      for (let i = 0; i < 7; i++) {
        const jourCourant = new Date(curseur)
        jourCourant.setDate(curseur.getDate() + i)
        if (joursVoulus.has(ORDRE_JOURS[jourCourant.getDay()])) ajoute(jourCourant)
      }
      semaines += rule.intervalle
      curseur.setDate(curseur.getDate() + 7 * rule.intervalle)
      const jd = jour(curseur)
      if (jd > fenetreFin || (untilJour !== null && jd > untilJour)) break
      if (semaines > GARDE) break
    }
    candidats.sort((a, b) => a.getTime() - b.getTime())
  } else {
    const departDay = depart.getDate()
    for (let i = 0; i < GARDE; i++) {
      let d: Date
      if (rule.freq === 'mensuel') {
        d = new Date(depart.getFullYear(), depart.getMonth() + i * rule.intervalle, 1)
        const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(departDay, dernierJour))
      } else if (rule.freq === 'annuel') {
        d = new Date(depart.getFullYear() + i * rule.intervalle, depart.getMonth(), 1)
        const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(departDay, dernierJour))
      } else if (rule.freq === 'hebdo') {
        d = new Date(depart)
        d.setDate(depart.getDate() + i * 7 * rule.intervalle)
      } else {
        // quotidien (et défaut)
        d = new Date(depart)
        d.setDate(depart.getDate() + i * rule.intervalle)
      }
      ajoute(d)
      if (jour(d) > fenetreFin || (untilJour !== null && jour(d) > untilJour)) break
    }
  }

  for (const d of candidats) {
    const jd = jour(d)
    if (jd < jour(depart)) continue // jamais avant le maître
    if (untilJour !== null && jd > untilJour) break
    nbGeneres++
    if (nbGeneres > maxCount) break
    if (jd >= fenetreDebut && jd <= fenetreFin) resultats.push(fmtDateTime(d))
  }
  return resultats
}

// Réexport interne pour agenda.ts (durée d'une occurrence)
export { parseDateTime, fmtDateTime }
