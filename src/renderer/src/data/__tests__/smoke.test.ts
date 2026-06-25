import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('infra de test', () => {
  it('applique les migrations et lit le profil seed', async () => {
    const db = await makeTestDb()
    const row = db.prepare('SELECT pseudo FROM profil WHERE id = 1').get() as { pseudo: string }
    expect(row.pseudo).toBe('Héros')
  })
})
