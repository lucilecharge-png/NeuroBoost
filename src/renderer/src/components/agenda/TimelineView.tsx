import { useRef } from 'react'
import type { OccurrenceDTO } from '../../../../shared/types'
import { positionOccurrence } from './timelineLayout'

const HEURE_BASE = 7
const HEURE_FIN = 23
const PX_H = 48

interface Props {
  jours: string[] // ['YYYY-MM-DD', ...] (1, 3 ou 7)
  occurrences: OccurrenceDTO[]
  onCreer: (debut: string) => void          // clic créneau vide
  onEditer: (occ: OccurrenceDTO) => void     // clic occurrence
  onDeplacer: (occ: OccurrenceDTO, nouveauDebut: string) => void // drop
}

function p2(n: number): string { return n.toString().padStart(2, '0') }

function aujourdHuiLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

export default function TimelineView({ jours, occurrences, onCreer, onEditer, onDeplacer }: Props): JSX.Element {
  const heures = Array.from({ length: HEURE_FIN - HEURE_BASE }, (_, i) => HEURE_BASE + i)
  const drag = useRef<{ occ: OccurrenceDTO } | null>(null)

  const today = aujourdHuiLocal()
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowTop = ((nowMin - HEURE_BASE * 60) / 60) * PX_H

  function clicColonne(jour: string, e: React.MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const minutes = ((e.clientY - rect.top) / PX_H) * 60 + HEURE_BASE * 60
    const h = Math.min(Math.floor(minutes / 60), 23)
    const m = Math.floor((minutes % 60) / 15) * 15
    onCreer(`${jour} ${p2(h)}:${p2(m)}`)
  }

  function deposer(jour: string, e: React.MouseEvent): void {
    if (!drag.current) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const minutes = ((e.clientY - rect.top) / PX_H) * 60 + HEURE_BASE * 60
    const h = Math.min(Math.floor(minutes / 60), 23)
    const m = Math.floor((minutes % 60) / 15) * 15
    onDeplacer(drag.current.occ, `${jour} ${p2(h)}:${p2(m)}`)
    drag.current = null
  }

  return (
    <div className="timeline-wrap">
      {/* All-day strip */}
      <div className="timeline-allday">
        <div className="timeline-allday-gutter" />
        {jours.map((jour) => (
          <div key={jour} className="timeline-allday-cell" onClick={() => onCreer(`${jour} 00:00`)}>
            {occurrences.filter((o) => o.dateOccurrence === jour && o.allDay).map((o) => (
              <div key={`${o.masterId}-${o.dateOccurrence}`} className="allday-chip"
                style={{ background: o.categorie?.couleur ?? '#7c3aed' }}
                onClick={(e) => { e.stopPropagation(); onEditer(o) }}>
                {o.estRecurrent ? '↻ ' : ''}{o.titre}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Hour grid */}
      <div className="timeline">
        <div className="timeline-gutter">
          {heures.map((h) => <div key={h} className="timeline-heure" style={{ height: PX_H }}>{p2(h)}:00</div>)}
        </div>
        {jours.map((jour) => (
          <div key={jour} className="timeline-col" onClick={(e) => clicColonne(jour, e)}
            onMouseUp={(e) => deposer(jour, e)}
            style={{ height: PX_H * (HEURE_FIN - HEURE_BASE) }}>
            {occurrences.filter((o) => o.dateOccurrence === jour && !o.allDay).map((o) => {
              const { top, height } = positionOccurrence(o.debut, o.fin, HEURE_BASE, PX_H)
              return (
                <div key={`${o.masterId}-${o.dateOccurrence}`} className="timeline-event"
                  style={{ top, height, background: o.categorie?.couleur ?? '#7c3aed' }}
                  onClick={(e) => { e.stopPropagation(); onEditer(o) }}
                  onMouseDown={(e) => { e.stopPropagation(); drag.current = { occ: o } }}>
                  <span className="timeline-event-titre">{o.estRecurrent ? '↻ ' : ''}{o.titre}</span>
                </div>
              )
            })}
            {jour === today && nowMin >= HEURE_BASE * 60 && nowMin < HEURE_FIN * 60 && (
              <div className="timeline-now" style={{ top: nowTop }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
