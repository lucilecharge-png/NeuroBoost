import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import { contentFingerprint } from '../sync/fingerprint'

describe('contentFingerprint', () => {
  it('est déterministe : même base, deux appels → même empreinte', async () => {
    const db = await makeTestDb()
    expect(await contentFingerprint(db)).toBe(await contentFingerprint(db))
  })

  it('deux bases au contenu identique ont la même empreinte', async () => {
    const a = await makeTestDb()
    const b = await makeTestDb()
    expect(await contentFingerprint(a)).toBe(await contentFingerprint(b))
  })

  it('change quand les données changent (NeuroCoins)', async () => {
    const db = await makeTestDb()
    const avant = await contentFingerprint(db)
    db.exec('UPDATE profil SET neurocoins = 50 WHERE id = 1')
    const apres = await contentFingerprint(db)
    expect(apres).not.toBe(avant)
  })
})
