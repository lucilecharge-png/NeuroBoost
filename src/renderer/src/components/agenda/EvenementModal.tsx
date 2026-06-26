import { useState } from 'react'
import type { CategorieDTO, EvenementInput, JourSemaine, ModeRecurrence, OccurrenceDTO, RecurrenceRule, TacheDTO } from '../../../../shared/types'
import CategoriePicker from './CategoriePicker'

function ajouterMs(debut: string, ms: number): string {
  const [d, t] = debut.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  const dd = new Date(y, mo - 1, da, h, mi)
  const r = new Date(dd.getTime() + ms)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${r.getFullYear()}-${p(r.getMonth() + 1)}-${p(r.getDate())} ${p(r.getHours())}:${p(r.getMinutes())}`
}

interface Props {
  occurrence: OccurrenceDTO | null // null = création
  debutInitial: string             // 'YYYY-MM-DD HH:MM' pré-rempli (création)
  categories: CategorieDTO[]
  onCreerCategorie: (nom: string, couleur: string) => Promise<void>
  onValider: (input: EvenementInput, mode: ModeRecurrence) => Promise<void>
  onSupprimer: (mode: ModeRecurrence) => Promise<void>
  onFermer: () => void
  quetesActives: TacheDTO[]
  onToggleFait: (occ: OccurrenceDTO) => Promise<void>
}

const JOURS: { code: JourSemaine; label: string }[] = [
  { code: 'LU', label: 'L' }, { code: 'MA', label: 'M' }, { code: 'ME', label: 'M' },
  { code: 'JE', label: 'J' }, { code: 'VE', label: 'V' }, { code: 'SA', label: 'S' }, { code: 'DI', label: 'D' }
]
const RAPPELS: { min: number | null; label: string }[] = [
  { min: null, label: 'Aucun' }, { min: 5, label: '5 min' }, { min: 10, label: '10 min' },
  { min: 30, label: '30 min' }, { min: 60, label: '1 h' }, { min: 1440, label: 'La veille' }
]

function toInput(s: string): string { return s.replace(' ', 'T') }
function fromInput(s: string): string { return s.replace('T', ' ').slice(0, 16) }

export default function EvenementModal(props: Props): JSX.Element {
  const { occurrence, debutInitial, categories } = props
  const enEdition = occurrence !== null

  const [titre, setTitre] = useState(occurrence?.titre ?? '')
  const [debut, setDebut] = useState(debutInitial)
  const [fin, setFin] = useState(
    occurrence
      ? ajouterMs(debutInitial, new Date(occurrence.fin.replace(' ', 'T')).getTime() - new Date(occurrence.debut.replace(' ', 'T')).getTime())
      : ajouterMs(debutInitial, 3600000)
  )
  const [allDay, setAllDay] = useState(occurrence?.allDay ?? false)
  const [categorieId, setCategorieId] = useState<number | null>(occurrence?.categorie?.id ?? null)
  const [description, setDescription] = useState(occurrence?.description ?? '')
  const [rappelMin, setRappelMin] = useState<number | null>(occurrence?.rappelMin ?? null)
  const [tacheId, setTacheId] = useState<number | null>(occurrence?.tacheId ?? null)

  const recInit = occurrence?.recurrence ?? null
  const [recurrent, setRecurrent] = useState(recInit !== null)
  const [freq, setFreq] = useState<RecurrenceRule['freq']>(recInit?.freq ?? 'hebdo')
  const [intervalle, setIntervalle] = useState(recInit?.intervalle ?? 1)
  const [jours, setJours] = useState<JourSemaine[]>(recInit?.jours ?? ['LU'])
  const [finType, setFinType] = useState<'jamais' | 'date' | 'count'>(
    recInit?.fin?.type === 'date' ? 'date' : recInit?.fin?.type === 'count' ? 'count' : 'jamais'
  )
  const [finDate, setFinDate] = useState(recInit?.fin?.type === 'date' ? recInit.fin.date : debutInitial.slice(0, 10))
  const [finCount, setFinCount] = useState(recInit?.fin?.type === 'count' ? recInit.fin.count : 10)

  const [mode, setMode] = useState<ModeRecurrence>('serie')
  const [rappelPerso, setRappelPerso] = useState(false)

  function construireRecurrence(): RecurrenceRule | null {
    if (!recurrent) return null
    const rule: RecurrenceRule = { freq, intervalle: Math.max(1, intervalle) }
    if (freq === 'hebdo') rule.jours = jours
    if (finType === 'date') rule.fin = { type: 'date', date: finDate }
    else if (finType === 'count') rule.fin = { type: 'count', count: finCount }
    return rule
  }

  async function valider(): Promise<void> {
    if (!titre.trim()) return
    const input: EvenementInput = {
      titre: titre.trim(), debut, fin, allDay,
      categorieId, description: description.trim() || null,
      recurrence: construireRecurrence(), rappelMin, tacheId
    }
    await props.onValider(input, occurrence?.estRecurrent ? mode : 'serie')
  }

  function toggleJour(j: JourSemaine): void {
    setJours((p) => (p.includes(j) ? p.filter((x) => x !== j) : [...p, j]))
  }

  return (
    <div className="modal-overlay" onClick={props.onFermer}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{enEdition ? 'Modifier' : 'Nouvel événement'}</strong>
          <button className="btn-icon" onClick={props.onFermer}>✕</button>
        </div>

        <input className="input" placeholder="Titre" value={titre} autoFocus
          onChange={(e) => setTitre(e.target.value)} style={{ marginTop: 10 }} />

        <label className="row" style={{ gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Journée entière
        </label>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input type={allDay ? 'date' : 'datetime-local'} className="input"
            value={allDay ? debut.slice(0, 10) : toInput(debut)}
            onChange={(e) => setDebut(allDay ? `${e.target.value} 00:00` : fromInput(e.target.value))} />
          <input type={allDay ? 'date' : 'datetime-local'} className="input"
            value={allDay ? fin.slice(0, 10) : toInput(fin)}
            onChange={(e) => setFin(allDay ? `${e.target.value} 23:59` : fromInput(e.target.value))} />
        </div>

        <div style={{ marginTop: 10 }}>
          <CategoriePicker categories={categories} valeur={categorieId}
            onChange={setCategorieId} onCreer={props.onCreerCategorie} />
        </div>

        <textarea className="input" placeholder="Notes (optionnel)" value={description}
          onChange={(e) => setDescription(e.target.value)} style={{ marginTop: 10, minHeight: 50 }} />

        <div className="label" style={{ marginTop: 10 }}>Lier à une quête existante</div>
        <select className="input" value={tacheId ?? ''} onChange={(e) => setTacheId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Aucune (créera une quête en cochant « fait »)</option>
          {props.quetesActives.map((q) => (
            <option key={q.id} value={q.id}>{q.titre}</option>
          ))}
        </select>

        {/* Rappel */}
        <div className="label" style={{ marginTop: 10 }}>Rappel</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {RAPPELS.map((r) => (
            <button key={String(r.min)} type="button"
              className={`cat-chip${!rappelPerso && rappelMin === r.min ? ' active' : ''}`}
              onClick={() => { setRappelPerso(false); setRappelMin(r.min) }}>{r.label}</button>
          ))}
          <button type="button" className={`cat-chip${rappelPerso ? ' active' : ''}`} onClick={() => setRappelPerso(true)}>Perso…</button>
          {rappelPerso && (
            <input className="input" type="number" min={0} style={{ width: 90 }} placeholder="min"
              value={rappelMin ?? 0} onChange={(e) => setRappelMin(Number(e.target.value))} />
          )}
        </div>

        {/* Récurrence */}
        <label className="row" style={{ gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={recurrent} onChange={(e) => setRecurrent(e.target.checked)} /> Répéter
        </label>
        {recurrent && (
          <div className="col" style={{ gap: 8, marginTop: 6 }}>
            <div className="row" style={{ gap: 8 }}>
              <span>tous les</span>
              <input className="input" type="number" min={1} style={{ width: 60 }}
                value={intervalle} onChange={(e) => setIntervalle(Number(e.target.value))} />
              <select className="input" value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceRule['freq'])}>
                <option value="quotidien">jour(s)</option>
                <option value="hebdo">semaine(s)</option>
                <option value="mensuel">mois</option>
                <option value="annuel">an(s)</option>
              </select>
            </div>
            {freq === 'hebdo' && (
              <div className="row" style={{ gap: 4 }}>
                {JOURS.map((j) => (
                  <button key={j.code} type="button"
                    className={`cat-chip${jours.includes(j.code) ? ' active' : ''}`}
                    onClick={() => toggleJour(j.code)} style={{ width: 30, padding: 4 }}>{j.label}</button>
                ))}
              </div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <select className="input" value={finType} onChange={(e) => setFinType(e.target.value as 'jamais' | 'date' | 'count')}>
                <option value="jamais">sans fin</option>
                <option value="date">jusqu'au</option>
                <option value="count">nombre</option>
              </select>
              {finType === 'date' && <input className="input" type="date" value={finDate} onChange={(e) => setFinDate(e.target.value)} />}
              {finType === 'count' && <input className="input" type="number" min={1} value={finCount} onChange={(e) => setFinCount(Number(e.target.value))} style={{ width: 80 }} />}
            </div>
          </div>
        )}

        {/* Mode d'application (édition d'un récurrent) */}
        {enEdition && occurrence?.estRecurrent && (
          <div className="col" style={{ gap: 4, marginTop: 10 }}>
            <div className="label">Appliquer à</div>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as ModeRecurrence)}>
              <option value="occurrence">Cette occurrence</option>
              <option value="suivantes">Cette occurrence et les suivantes</option>
              <option value="serie">Toute la série</option>
            </select>
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          {enEdition && (
            <button className="btn-icon" title="Supprimer"
              onClick={() => props.onSupprimer(occurrence?.estRecurrent ? mode : 'serie')}>🗑</button>
          )}
          {enEdition && occurrence && (
            <button
              className="btn-secondary"
              onClick={async () => { await props.onToggleFait(occurrence); props.onFermer() }}
            >
              {occurrence.fait ? '↩︎ Annuler « fait »' : '✓ Marquer fait'}
            </button>
          )}
          <button className="btn-launch" onClick={valider} disabled={!titre.trim()}>
            {enEdition ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
