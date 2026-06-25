import { describe, it, expect } from 'vitest'
import { expanseRecurrence } from '../recurrence'
import type { RecurrenceRule } from '../../../shared/types'

const debutMaitre = '2026-06-01 09:00' // lundi 1er juin 2026

describe('expanseRecurrence', () => {
  it('quotidien dans une fenêtre de 3 jours', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1 }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-03')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-02 09:00', '2026-06-03 09:00'])
  })

  it('quotidien avec intervalle 2', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 2 }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-05')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-03 09:00', '2026-06-05 09:00'])
  })

  it('hebdo multi-jours (LU, ME)', () => {
    const rule: RecurrenceRule = { freq: 'hebdo', intervalle: 1, jours: ['LU', 'ME'] }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-10')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-03 09:00', '2026-06-08 09:00', '2026-06-10 09:00'])
  })

  it('respecte COUNT depuis le début du maître', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1, fin: { type: 'count', count: 2 } }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-30')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-02 09:00'])
  })

  it('respecte UNTIL (inclusif)', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1, fin: { type: 'date', date: '2026-06-02' } }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-30')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-02 09:00'])
  })

  it('mensuel garde le quantième', () => {
    const rule: RecurrenceRule = { freq: 'mensuel', intervalle: 1 }
    const occ = expanseRecurrence(rule, '2026-01-15 10:00', '2026-01-01', '2026-04-30')
    expect(occ).toEqual(['2026-01-15 10:00', '2026-02-15 10:00', '2026-03-15 10:00', '2026-04-15 10:00'])
  })

  it('ne renvoie rien avant le début du maître', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1 }
    const occ = expanseRecurrence(rule, '2026-06-10 09:00', '2026-06-01', '2026-06-09')
    expect(occ).toEqual([])
  })
})
