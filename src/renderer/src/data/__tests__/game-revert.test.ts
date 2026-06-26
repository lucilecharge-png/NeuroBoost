import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import { createTache, terminerTache, annulerCompletion, getProfil } from '../game'

describe('annulerCompletion — revert XP/coins/niveau', () => {
  it('ramène le profil à son état antérieur après une complétion simple', async () => {
    const db = await makeTestDb()
    const avant = getProfil(db)
    const t = createTache(db, { titre: 'X', niveauEnergie: 'moyenne' }) // +30 XP / +15 coins
    terminerTache(db, t.id)
    annulerCompletion(db, t.xpRecompense, t.coinsRecompense)
    const apres = getProfil(db)
    expect(apres.xp).toBe(avant.xp)
    expect(apres.niveau).toBe(avant.niveau)
    expect(apres.neurocoins).toBe(avant.neurocoins)
    expect(apres.totalTachesTerminees).toBe(avant.totalTachesTerminees)
  })

  it('redescend correctement d\'un niveau franchi', async () => {
    const db = await makeTestDb()
    const a = createTache(db, { titre: 'A', niveauEnergie: 'haute' }) // 60
    const b = createTache(db, { titre: 'B', niveauEnergie: 'haute' }) // 60 → total 120 ≥ 100 ⇒ niveau 2
    terminerTache(db, a.id)
    terminerTache(db, b.id)
    expect(getProfil(db).niveau).toBe(2)
    annulerCompletion(db, 60, 30)
    const p = getProfil(db)
    expect(p.niveau).toBe(1)
    expect(p.xp).toBe(60)
    expect(p.xpProchainNiveau).toBe(100)
  })

  it('borne à zéro sans passer négatif', async () => {
    const db = await makeTestDb()
    const t = createTache(db, { titre: 'X', niveauEnergie: 'micro' }) // 5 / 3
    terminerTache(db, t.id)
    annulerCompletion(db, 999, 999)
    const p = getProfil(db)
    expect(p.xp).toBeGreaterThanOrEqual(0)
    expect(p.neurocoins).toBeGreaterThanOrEqual(0)
    expect(p.niveau).toBe(1)
  })
})
