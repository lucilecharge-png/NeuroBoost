import { describe, it, expect } from 'vitest'
import { positionOccurrence } from '../../components/agenda/timelineLayout'

describe('positionOccurrence', () => {
  it('place un créneau 10:00–11:00 avec heure de base 8 et 48px/h', () => {
    const r = positionOccurrence('2026-06-10 10:00', '2026-06-10 11:00', 8, 48)
    expect(r).toEqual({ top: 96, height: 48 }) // (10-8)*48=96 ; 1h=48
  })
  it('hauteur minimale de 18px pour un créneau très court', () => {
    const r = positionOccurrence('2026-06-10 10:00', '2026-06-10 10:05', 8, 48)
    expect(r.height).toBe(18)
  })
})
