import { describe, it, expect } from 'vitest'
import { plageVue, libellePeriode, naviguer, type VueAgenda } from '../agendaNav'

describe('agendaNav', () => {
  it('plage jour', () => {
    expect(plageVue('jour', '2026-06-10')).toEqual({ debut: '2026-06-10', fin: '2026-06-10' })
  })
  it('plage semaine (lundi→dimanche) pour un mercredi', () => {
    // 2026-06-10 est un mercredi
    expect(plageVue('semaine', '2026-06-10')).toEqual({ debut: '2026-06-08', fin: '2026-06-14' })
  })
  it('plage mois', () => {
    expect(plageVue('mois', '2026-06-10')).toEqual({ debut: '2026-06-01', fin: '2026-06-30' })
  })
  it('plage trimestre (3 mois à partir du mois courant)', () => {
    expect(plageVue('trimestre', '2026-06-10')).toEqual({ debut: '2026-06-01', fin: '2026-08-31' })
  })
  it('navigation jour suivant', () => {
    expect(naviguer('jour', '2026-06-10', 1)).toBe('2026-06-11')
  })
  it('navigation mois précédent', () => {
    expect(naviguer('mois', '2026-06-10', -1)).toBe('2026-05-10')
  })
  it('libellé mois', () => {
    expect(libellePeriode('mois', '2026-06-10')).toMatch(/juin 2026/i)
  })
})
