import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import { annulerCompletion, getProfil } from '../game'

// On teste la MATH du revert en isolation : on seed directement la ligne profil,
// sans passer par terminerTache (qui déclenche des achievements à bonus XP).
describe('annulerCompletion — revert XP/coins/niveau', () => {
  it('retire XP, coins et décrémente le compteur de tâches', async () => {
    const db = await makeTestDb()
    db.prepare('UPDATE profil SET xp = 40, niveau = 1, xp_prochain_niveau = 100, neurocoins = 20, total_taches_terminees = 3 WHERE id = 1').run()
    annulerCompletion(db, 30, 15)
    const p = getProfil(db)
    expect(p.xp).toBe(10)
    expect(p.niveau).toBe(1)
    expect(p.xpProchainNiveau).toBe(100)
    expect(p.neurocoins).toBe(5)
    expect(p.totalTachesTerminees).toBe(2)
  })

  it('redescend correctement d\'un niveau franchi', async () => {
    const db = await makeTestDb()
    // Profil niveau 2 avec 10 XP : XP absolu = cumul(2)=100 + 10 = 110.
    db.prepare('UPDATE profil SET xp = 10, niveau = 2, xp_prochain_niveau = 200, neurocoins = 30, total_taches_terminees = 2 WHERE id = 1').run()
    annulerCompletion(db, 60, 30) // 110 - 60 = 50 ⇒ niveau 1, xp 50, prochain 100
    const p = getProfil(db)
    expect(p.niveau).toBe(1)
    expect(p.xp).toBe(50)
    expect(p.xpProchainNiveau).toBe(100)
  })

  it('borne à zéro sans passer négatif', async () => {
    const db = await makeTestDb()
    db.prepare('UPDATE profil SET xp = 5, niveau = 1, xp_prochain_niveau = 100, neurocoins = 3, total_taches_terminees = 1 WHERE id = 1').run()
    annulerCompletion(db, 999, 999)
    const p = getProfil(db)
    expect(p.xp).toBe(0)
    expect(p.neurocoins).toBe(0)
    expect(p.niveau).toBe(1)
    expect(p.totalTachesTerminees).toBe(0)
  })
})
