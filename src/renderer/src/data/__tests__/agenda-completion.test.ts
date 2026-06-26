import { describe, it, expect } from 'vitest'
import { dureeVersEnergie } from '../agenda'
import { makeTestDb } from './testDb'
import * as A from '../agenda'
import { createTache, getProfil, terminerTache } from '../game'

describe('dureeVersEnergie', () => {
  it('mappe la durée sur un niveau d\'énergie', () => {
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:03', false)).toBe('micro')   // 3 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:10', false)).toBe('faible')  // 10 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:30', false)).toBe('moyenne') // 30 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 11:00', false)).toBe('haute')   // 120 min
  })

  it('traite les bornes (5/15/45)', () => {
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:05', false)).toBe('faible')  // 5 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:15', false)).toBe('moyenne') // 15 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:45', false)).toBe('haute')   // 45 min
  })

  it('renvoie faible pour une journée entière', () => {
    expect(dureeVersEnergie('2026-06-10 00:00', '2026-06-10 23:59', true)).toBe('faible')
  })
})

describe('terminerEvenement', () => {
  it('cas à la volée : crée une quête terminée et journalise la complétion', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'Méditer', debut: '2026-06-10 09:00', fin: '2026-06-10 09:10' })
    const res = A.terminerEvenement(db, ev.id, '2026-06-10')
    expect(res.xpGagne).toBe(15) // 10 min ⇒ faible ⇒ 15 XP
    const row = db.prepare('SELECT * FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?')
      .get(ev.id, '2026-06-10') as Record<string, unknown>
    expect(row.auto_creee).toBe(1)
    const tache = db.prepare('SELECT * FROM taches WHERE id = ?').get(row.tache_id) as Record<string, unknown>
    expect(tache.statut).toBe('terminee')
    expect(tache.titre).toBe('Méditer')
  })

  it('cas lié : termine la quête liée, auto_creee = 0', async () => {
    const db = await makeTestDb()
    const t = createTache(db, { titre: 'Dossier', niveauEnergie: 'haute' })
    const ev = A.createEvenement(db, { titre: 'Bloc dossier', debut: '2026-06-10 09:00', fin: '2026-06-10 10:00', tacheId: t.id })
    const res = A.terminerEvenement(db, ev.id, '2026-06-10')
    expect(res.xpGagne).toBe(60) // XP de la quête liée (haute)
    const row = db.prepare('SELECT * FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as Record<string, unknown>
    expect(row.auto_creee).toBe(0)
    expect(row.tache_id).toBe(t.id)
    const tache = db.prepare('SELECT statut FROM taches WHERE id = ?').get(t.id) as { statut: string }
    expect(tache.statut).toBe('terminee')
  })

  it('idempotent : une 2ᵉ complétion de la même occurrence ne re-crédite pas', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'X', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30' })
    A.terminerEvenement(db, ev.id, '2026-06-10')
    const profilApres1 = getProfil(db)
    A.terminerEvenement(db, ev.id, '2026-06-10')
    const profilApres2 = getProfil(db)
    expect(profilApres2.xp).toBe(profilApres1.xp)
    expect(profilApres2.totalTachesTerminees).toBe(profilApres1.totalTachesTerminees)
    const n = db.prepare('SELECT COUNT(*) as n FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { n: number }
    expect(n.n).toBe(1)
  })

  it('occurrence récurrente : cocher une date n\'affecte pas les autres', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, {
      titre: 'Sport', debut: '2026-06-01 18:00', fin: '2026-06-01 19:00',
      recurrence: { freq: 'hebdo', intervalle: 1, jours: ['LU'] }
    })
    A.terminerEvenement(db, ev.id, '2026-06-08')
    const n = db.prepare('SELECT COUNT(*) as n FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { n: number }
    expect(n.n).toBe(1)
    const row = db.prepare('SELECT date_occurrence FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { date_occurrence: string }
    expect(row.date_occurrence).toBe('2026-06-08')
  })
})

describe('annulerEvenement', () => {
  it('cas à la volée : supprime la quête éclair et revert XP/coins', async () => {
    const db = await makeTestDb()
    // Warm-up : consomme l'achievement premier_pas pour qu'il ne pollue pas la mesure.
    const warm = createTache(db, { titre: 'warmup', niveauEnergie: 'micro' })
    terminerTache(db, warm.id)
    const avant = getProfil(db)
    const ev = A.createEvenement(db, { titre: 'X', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30' })
    A.terminerEvenement(db, ev.id, '2026-06-10')
    const row = db.prepare('SELECT tache_id FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { tache_id: number }
    A.annulerEvenement(db, ev.id, '2026-06-10')
    const apres = getProfil(db)
    expect(apres.xp).toBe(avant.xp)
    expect(apres.neurocoins).toBe(avant.neurocoins)
    expect(apres.totalTachesTerminees).toBe(avant.totalTachesTerminees)
    expect(db.prepare('SELECT 1 FROM taches WHERE id = ?').get(row.tache_id)).toBeUndefined()
    expect(db.prepare('SELECT 1 FROM evenement_completion WHERE evenement_id = ?').get(ev.id)).toBeUndefined()
  })

  it('cas lié : rouvre la quête (active) sans la supprimer', async () => {
    const db = await makeTestDb()
    const t = createTache(db, { titre: 'Dossier', niveauEnergie: 'moyenne' })
    const ev = A.createEvenement(db, { titre: 'Bloc', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30', tacheId: t.id })
    A.terminerEvenement(db, ev.id, '2026-06-10')
    A.annulerEvenement(db, ev.id, '2026-06-10')
    const tache = db.prepare('SELECT statut, completee_le FROM taches WHERE id = ?').get(t.id) as { statut: string; completee_le: string | null }
    expect(tache.statut).toBe('active')
    expect(tache.completee_le).toBeNull()
    expect(db.prepare('SELECT 1 FROM evenement_completion WHERE evenement_id = ?').get(ev.id)).toBeUndefined()
  })

  it('no-op si l\'occurrence n\'est pas complétée', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'X', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30' })
    expect(() => A.annulerEvenement(db, ev.id, '2026-06-10')).not.toThrow()
  })
})

describe('listEvenements — champ fait', () => {
  it('marque fait uniquement l\'occurrence complétée', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, {
      titre: 'Sport', debut: '2026-06-01 18:00', fin: '2026-06-01 19:00',
      recurrence: { freq: 'hebdo', intervalle: 1, jours: ['LU'] }
    })
    A.terminerEvenement(db, ev.id, '2026-06-08')
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-30')
    const fait = occ.filter((o) => o.fait).map((o) => o.dateOccurrence)
    expect(fait).toEqual(['2026-06-08'])
    expect(occ.find((o) => o.dateOccurrence === '2026-06-01')!.fait).toBe(false)
  })
})
