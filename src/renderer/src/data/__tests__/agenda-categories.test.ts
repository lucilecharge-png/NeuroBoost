import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

describe('catégories', () => {
  it('liste les 4 catégories système', async () => {
    const db = await makeTestDb()
    const cats = A.listCategories(db)
    expect(cats).toHaveLength(4)
    expect(cats[0]).toMatchObject({ nom: 'Perso', couleur: '#7c3aed', estSysteme: true })
  })

  it('crée puis supprime une catégorie perso', async () => {
    const db = await makeTestDb()
    const cat = A.createCategorie(db, 'Sport', '#ef4444', '🏃')
    expect(cat).toMatchObject({ nom: 'Sport', estSysteme: false })
    expect(A.listCategories(db)).toHaveLength(5)
    A.deleteCategorie(db, cat.id)
    expect(A.listCategories(db)).toHaveLength(4)
  })

  it('refuse de supprimer une catégorie système', async () => {
    const db = await makeTestDb()
    A.deleteCategorie(db, 1) // Perso (système)
    expect(A.listCategories(db)).toHaveLength(4)
  })
})
