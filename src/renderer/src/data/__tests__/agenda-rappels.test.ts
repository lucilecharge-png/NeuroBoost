import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

describe('rappels', () => {
  it('renvoie les occurrences à rappeler dans l’horizon', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, { titre: 'RDV', debut: '2026-06-02 10:00', fin: '2026-06-02 11:00', rappelMin: 30 })
    A.createEvenement(db, { titre: 'Sans rappel', debut: '2026-06-02 12:00', fin: '2026-06-02 13:00' })
    const rappels = A.listProchainsRappels(db, '2026-06-01 09:00', 14)
    expect(rappels).toHaveLength(1)
    expect(rappels[0]).toMatchObject({ titre: 'RDV', rappelMin: 30, debut: '2026-06-02 10:00' })
  })

  it('ignore un rappel déjà passé', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, { titre: 'Passé', debut: '2026-06-01 09:10', fin: '2026-06-01 09:40', rappelMin: 30 })
    // instant de rappel = 08:40, déjà passé à 09:00
    const rappels = A.listProchainsRappels(db, '2026-06-01 09:00', 14)
    expect(rappels).toHaveLength(0)
  })
})
