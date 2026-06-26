import { describe, it, expect } from 'vitest'
import { dureeVersEnergie } from '../agenda'

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
