// Calcul pur de la position verticale d'une occurrence sur la grille horaire.
function minutesDepuis(debut: string): number {
  const [h, m] = debut.slice(11).split(':').map(Number)
  return h * 60 + m
}

export function positionOccurrence(
  debut: string, fin: string, heureBase: number, pxParHeure: number
): { top: number; height: number } {
  const top = ((minutesDepuis(debut) - heureBase * 60) / 60) * pxParHeure
  const dureeMin = minutesDepuis(fin) - minutesDepuis(debut)
  const height = Math.max(18, (dureeMin / 60) * pxParHeure)
  return { top, height }
}
