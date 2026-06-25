import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

async function dbAvecSerie() {
  const db = await makeTestDb()
  const ev = A.createEvenement(db, {
    titre: 'Standup', debut: '2026-06-01 09:00', fin: '2026-06-01 09:15',
    recurrence: { freq: 'quotidien', intervalle: 1 }
  })
  return { db, id: ev.id }
}

describe('modes de récurrence', () => {
  it('supprime une seule occurrence', async () => {
    const { db, id } = await dbAvecSerie()
    A.deleteEvenement(db, id, '2026-06-03', 'occurrence')
    const dates = A.listEvenements(db, '2026-06-01', '2026-06-05').map((o) => o.dateOccurrence)
    expect(dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05'])
  })

  it('édite une seule occurrence (titre)', async () => {
    const { db, id } = await dbAvecSerie()
    A.updateEvenement(db, id, '2026-06-03', 'occurrence', { titre: 'Standup spécial' })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-05')
    const le3 = occ.find((o) => o.dateOccurrence === '2026-06-03')
    expect(le3?.titre).toBe('Standup spécial')
    expect(occ.filter((o) => o.titre === 'Standup')).toHaveLength(4)
  })

  it('supprime cette occurrence et les suivantes', async () => {
    const { db, id } = await dbAvecSerie()
    A.deleteEvenement(db, id, '2026-06-03', 'suivantes')
    const dates = A.listEvenements(db, '2026-06-01', '2026-06-10').map((o) => o.dateOccurrence)
    expect(dates).toEqual(['2026-06-01', '2026-06-02'])
  })

  it('édite cette occurrence et les suivantes (scission)', async () => {
    const { db, id } = await dbAvecSerie()
    A.updateEvenement(db, id, '2026-06-04', 'suivantes', { titre: 'Standup v2' })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-06')
    expect(occ.filter((o) => o.titre === 'Standup')).toHaveLength(3)   // 1,2,3
    expect(occ.filter((o) => o.titre === 'Standup v2')).toHaveLength(3) // 4,5,6
  })

  it('édite toute la série', async () => {
    const { db, id } = await dbAvecSerie()
    A.updateEvenement(db, id, '2026-06-03', 'serie', { titre: 'Daily' })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-05')
    expect(occ.every((o) => o.titre === 'Daily')).toBe(true)
  })

  it('supprime toute la série', async () => {
    const { db, id } = await dbAvecSerie()
    A.deleteEvenement(db, id, '2026-06-03', 'serie')
    expect(A.listEvenements(db, '2026-06-01', '2026-06-30')).toHaveLength(0)
  })
})
