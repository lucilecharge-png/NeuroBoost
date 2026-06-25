import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('migration v8 agenda', () => {
  it('crée les 4 catégories système', async () => {
    const db = await makeTestDb()
    const rows = db.prepare('SELECT nom, est_systeme FROM categorie ORDER BY id').all() as { nom: string; est_systeme: number }[]
    expect(rows.map((r) => r.nom)).toEqual(['Perso', 'Travail', 'Santé', 'Admin'])
    expect(rows.every((r) => r.est_systeme === 1)).toBe(true)
  })

  it('crée la table evenement avec les colonnes dormantes source/google_id', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('evenement')").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['titre', 'debut', 'fin', 'all_day', 'categorie_id', 'recurrence', 'rappel_min', 'source', 'google_id']))
  })

  it('crée la table evenement_exception', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('evenement_exception')").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['evenement_id', 'date_occurrence', 'type', 'override_id']))
  })
})
