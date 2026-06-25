import { useRef } from 'react'
import type { OccurrenceDTO } from '../../../../shared/types'

interface Props {
  ancre: string // 'YYYY-MM-DD' dans le mois affiché
  occurrences: OccurrenceDTO[]
  onCreerJour: (date: string) => void
  onEditer: (occ: OccurrenceDTO) => void
  onDeplacer: (occ: OccurrenceDTO, nouvelleDate: string) => void
}

function p2(n: number): string { return n.toString().padStart(2, '0') }

export default function MoisView({ ancre, occurrences, onCreerJour, onEditer, onDeplacer }: Props): JSX.Element {
  const [y, m] = ancre.split('-').map(Number)
  const premier = new Date(y, m - 1, 1)
  const decalLundi = (premier.getDay() + 6) % 7
  const debutGrille = new Date(premier); debutGrille.setDate(1 - decalLundi)
  const cases = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille); d.setDate(debutGrille.getDate() + i)
    return d
  })
  const dragOcc = useRef<OccurrenceDTO | null>(null)
  const fmt = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

  return (
    <div className="mois-grid">
      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => (
        <div key={j} className="mois-entete">{j}</div>
      ))}
      {cases.map((d) => {
        const date = fmt(d)
        const duMois = d.getMonth() === m - 1
        const occ = occurrences.filter((o) => o.dateOccurrence === date)
        return (
          <div key={date} className={`mois-case${duMois ? '' : ' hors-mois'}`}
            onClick={() => onCreerJour(date)}
            onMouseUp={() => { if (dragOcc.current) { onDeplacer(dragOcc.current, date); dragOcc.current = null } }}>
            <div className="mois-num">{d.getDate()}</div>
            {occ.slice(0, 3).map((o) => (
              <div key={`${o.masterId}-${o.dateOccurrence}`} className="mois-pastille"
                style={{ background: o.categorie?.couleur ?? '#7c3aed' }}
                onClick={(e) => { e.stopPropagation(); onEditer(o) }}
                onMouseDown={(e) => { e.stopPropagation(); dragOcc.current = o }}>
                {o.titre}
              </div>
            ))}
            {occ.length > 3 && <div className="mois-plus">+{occ.length - 3}</div>}
          </div>
        )
      })}
    </div>
  )
}
