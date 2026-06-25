import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

describe('événements & occurrences', () => {
  it('crée un événement ponctuel et le retrouve dans la fenêtre', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'Dentiste', debut: '2026-06-10 14:00', fin: '2026-06-10 15:00', categorieId: 4 })
    expect(ev.id).toBeGreaterThan(0)
    const occ = A.listEvenements(db, '2026-06-08', '2026-06-12')
    expect(occ).toHaveLength(1)
    expect(occ[0]).toMatchObject({ titre: 'Dentiste', masterId: ev.id, estRecurrent: false })
    expect(occ[0].categorie?.nom).toBe('Admin')
  })

  it('exclut un événement hors fenêtre', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, { titre: 'Loin', debut: '2026-07-10 14:00', fin: '2026-07-10 15:00' })
    expect(A.listEvenements(db, '2026-06-01', '2026-06-30')).toHaveLength(0)
  })

  it('déroule un événement récurrent hebdomadaire', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, {
      titre: 'Sport', debut: '2026-06-01 18:00', fin: '2026-06-01 19:00',
      recurrence: { freq: 'hebdo', intervalle: 1, jours: ['LU'] }
    })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-30')
    expect(occ.map((o) => o.dateOccurrence)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
    expect(occ.every((o) => o.estRecurrent)).toBe(true)
  })
})
