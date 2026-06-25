import { describe, it, expect } from 'vitest'
import { serialiserRRULE, parserRRULE } from '../recurrence'
import type { RecurrenceRule } from '../../../shared/types'

describe('serialiserRRULE', () => {
  it('quotidien simple', () => {
    expect(serialiserRRULE({ freq: 'quotidien', intervalle: 1 })).toBe('FREQ=DAILY')
  })
  it('hebdo multi-jours avec intervalle', () => {
    expect(serialiserRRULE({ freq: 'hebdo', intervalle: 2, jours: ['LU', 'ME'] }))
      .toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')
  })
  it('mensuel avec UNTIL', () => {
    expect(serialiserRRULE({ freq: 'mensuel', intervalle: 1, fin: { type: 'date', date: '2026-09-01' } }))
      .toBe('FREQ=MONTHLY;UNTIL=20260901')
  })
  it('annuel avec COUNT', () => {
    expect(serialiserRRULE({ freq: 'annuel', intervalle: 1, fin: { type: 'count', count: 5 } }))
      .toBe('FREQ=YEARLY;COUNT=5')
  })
})

describe('parserRRULE (aller-retour)', () => {
  const cas: RecurrenceRule[] = [
    { freq: 'quotidien', intervalle: 1 },
    { freq: 'hebdo', intervalle: 2, jours: ['LU', 'ME', 'VE'] },
    { freq: 'mensuel', intervalle: 3, fin: { type: 'date', date: '2026-09-01' } },
    { freq: 'annuel', intervalle: 1, fin: { type: 'count', count: 4 } }
  ]
  for (const rule of cas) {
    it(JSON.stringify(rule), () => {
      expect(parserRRULE(serialiserRRULE(rule))).toEqual(rule)
    })
  }
})
