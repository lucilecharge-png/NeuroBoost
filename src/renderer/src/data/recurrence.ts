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
