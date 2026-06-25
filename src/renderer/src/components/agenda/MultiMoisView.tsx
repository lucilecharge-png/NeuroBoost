import type { OccurrenceDTO } from '../../../../shared/types'

interface Props {
  ancre: string
  nbMois: number
  occurrences: OccurrenceDTO[]
  onCreerJour: (date: string) => void  // clic
  onZoomJour: (date: string) => void   // double-clic
}

function p2(n: number): string { return n.toString().padStart(2, '0') }

function MiniMois({ y, m, parDate, onCreerJour, onZoomJour }: {
  y: number; m: number; parDate: Map<string, OccurrenceDTO[]>
  onCreerJour: (d: string) => void; onZoomJour: (d: string) => void
}): JSX.Element {
  const premier = new Date(y, m, 1)
  const decalLundi = (premier.getDay() + 6) % 7
  const debut = new Date(premier); debut.setDate(1 - decalLundi)
  const cases = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debut); d.setDate(debut.getDate() + i); return d
  })
  const fmt = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  return (
    <div className="mini-mois">
      <div className="mini-mois-titre">{premier.toLocaleDateString('fr-FR', { month: 'long' })}</div>
      <div className="mini-grid">
        {cases.map((d) => {
          const date = fmt(d)
          const has = (parDate.get(date)?.length ?? 0) > 0
          const couleur = parDate.get(date)?.[0]?.categorie?.couleur ?? '#7c3aed'
          return (
            <button key={date} className={`mini-jour${d.getMonth() === m ? '' : ' hors'}`}
              onClick={() => onCreerJour(date)} onDoubleClick={() => onZoomJour(date)}>
              <span>{d.getDate()}</span>
              {has && <span className="mini-point" style={{ background: couleur }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MultiMoisView({ ancre, nbMois, occurrences, onCreerJour, onZoomJour }: Props): JSX.Element {
  const [y, m] = ancre.split('-').map(Number)
  const parDate = new Map<string, OccurrenceDTO[]>()
  for (const o of occurrences) {
    const arr = parDate.get(o.dateOccurrence) ?? []
    arr.push(o); parDate.set(o.dateOccurrence, arr)
  }
  const mois = Array.from({ length: nbMois }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  // Regroupement par trimestre (bandeaux) si >= 3 mois
  return (
    <div className="multi-mois">
      {mois.map(({ y: yy, m: mm }, i) => (
        <div key={`${yy}-${mm}`} className="multi-mois-cell">
          {nbMois >= 3 && mm % 3 === 0 && <div className="multi-bandeau">T{Math.floor(mm / 3) + 1} {yy}</div>}
          <MiniMois y={yy} m={mm} parDate={parDate} onCreerJour={onCreerJour} onZoomJour={onZoomJour} />
        </div>
      ))}
    </div>
  )
}
