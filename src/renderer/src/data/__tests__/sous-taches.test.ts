import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as G from '../game'

describe('sous-tâches — parentId & listing', () => {
  it('expose parentId (null par défaut) sur le DTO', async () => {
    const db = await makeTestDb()
    const t = G.createTache(db, { titre: 'Préparer mon anniversaire' })
    expect(t.parentId).toBeNull()
  })

  it('listTaches masque un parent qui a une sous-tâche active', async () => {
    const db = await makeTestDb()
    const parent = G.createTache(db, { titre: 'Préparer mon anniversaire' })
    G.creerSousTaches(db, parent.id, [{ titre: 'Inviter les gens' }])
    const titres = G.listTaches(db, { statut: 'active' }).map((t) => t.titre)
    expect(titres).toContain('Inviter les gens')
    expect(titres).not.toContain('Préparer mon anniversaire')
  })

  it('termine automatiquement le parent quand la dernière sous-tâche est finie', async () => {
    const db = await makeTestDb()
    const parent = G.createTache(db, { titre: 'Préparer mon anniversaire' })
    const enfants = G.creerSousTaches(db, parent.id, [
      { titre: 'Inviter les gens' },
      { titre: 'Prévoir le gâteau' }
    ])

    const res1 = G.terminerTache(db, enfants[0].id)
    let p = db.prepare('SELECT statut FROM taches WHERE id = ?').get(parent.id) as { statut: string }
    expect(p.statut).toBe('active')
    // Pas de bonus parent tant que toutes les sous-tâches ne sont pas finies
    expect(res1.xpGagne).toBe(enfants[0].xpRecompense)

    const res = G.terminerTache(db, enfants[1].id)
    p = db.prepare('SELECT statut FROM taches WHERE id = ?').get(parent.id) as { statut: string }
    expect(p.statut).toBe('terminee')
    expect(res.xpGagne).toBeGreaterThan(enfants[1].xpRecompense)
  })
})
