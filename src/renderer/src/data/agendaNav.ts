// Helpers purs de navigation de l'agenda : plage de dates à charger, libellé de
// période, et déplacement ‹ › selon la vue. Dates au format 'YYYY-MM-DD'.
export type VueAgenda =
  | 'jour' | 'troisJours' | 'semaine'
  | 'mois'
  | 'trimestre' | 'semestre' | 'neufMois' | 'annee'

export const NB_MOIS: Record<string, number> = { trimestre: 3, semestre: 6, neufMois: 9, annee: 12 }

const p2 = (n: number): string => n.toString().padStart(2, '0')
const fmt = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const parse = (s: string): Date => {
  const [y, m, j] = s.split('-').map(Number)
  return new Date(y, m - 1, j)
}

function lundiDe(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export function plageVue(vue: VueAgenda, ancre: string): { debut: string; fin: string } {
  const d = parse(ancre)
  if (vue === 'jour') return { debut: ancre, fin: ancre }
  if (vue === 'troisJours') {
    const fin = new Date(d); fin.setDate(d.getDate() + 2)
    return { debut: ancre, fin: fmt(fin) }
  }
  if (vue === 'semaine') {
    const lundi = lundiDe(d)
    const dim = new Date(lundi); dim.setDate(lundi.getDate() + 6)
    return { debut: fmt(lundi), fin: fmt(dim) }
  }
  const nb = vue === 'mois' ? 1 : NB_MOIS[vue]
  const debut = new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = new Date(d.getFullYear(), d.getMonth() + nb, 0)
  return { debut: fmt(debut), fin: fmt(fin) }
}

export function naviguer(vue: VueAgenda, ancre: string, sens: 1 | -1): string {
  const d = parse(ancre)
  if (vue === 'jour') d.setDate(d.getDate() + sens)
  else if (vue === 'troisJours') d.setDate(d.getDate() + 3 * sens)
  else if (vue === 'semaine') d.setDate(d.getDate() + 7 * sens)
  else if (vue === 'mois') d.setMonth(d.getMonth() + sens)
  else d.setMonth(d.getMonth() + NB_MOIS[vue] * sens)
  return fmt(d)
}

export function libellePeriode(vue: VueAgenda, ancre: string): string {
  const d = parse(ancre)
  if (vue === 'jour' || vue === 'troisJours') {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (vue === 'semaine') {
    const { debut, fin } = plageVue('semaine', ancre)
    return `${parse(debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${parse(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  if (vue === 'mois') return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const { debut, fin } = plageVue(vue, ancre)
  return `${parse(debut).toLocaleDateString('fr-FR', { month: 'short' })} – ${parse(fin).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
}
