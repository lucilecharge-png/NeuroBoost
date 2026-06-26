import { useState, useEffect, useCallback } from 'react'
import type { CategorieDTO, EvenementInput, ModeRecurrence, OccurrenceDTO, TacheDTO, CompletionResult } from '../../../shared/types'
import { plageVue, naviguer, libellePeriode, type VueAgenda, NB_MOIS } from '../data/agendaNav'
import TimelineView from '../components/agenda/TimelineView'
import MoisView from '../components/agenda/MoisView'
import MultiMoisView from '../components/agenda/MultiMoisView'
import EvenementModal from '../components/agenda/EvenementModal'
import Celebration from '../components/Celebration'
import RappelsPermissionBanner from '../components/agenda/RappelsPermissionBanner'

const VUES: { id: VueAgenda; label: string }[] = [
  { id: 'jour', label: 'Jour' }, { id: 'troisJours', label: '3 jours' }, { id: 'semaine', label: 'Semaine' },
  { id: 'mois', label: 'Mois' }, { id: 'trimestre', label: 'Trim.' }, { id: 'semestre', label: 'Sem.' },
  { id: 'neufMois', label: '9 mois' }, { id: 'annee', label: 'Année' }
]

function aujourdHui(): string {
  const d = new Date(); const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function joursEntre(debut: string, fin: string): string[] {
  const out: string[] = []
  const p = (n: number) => n.toString().padStart(2, '0')
  const [yd, md, jd] = debut.split('-').map(Number)
  const [yf, mf, jf] = fin.split('-').map(Number)
  const d = new Date(yd, md - 1, jd)
  const f = new Date(yf, mf - 1, jf)
  while (d <= f) { out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`); d.setDate(d.getDate() + 1) }
  return out
}

export default function AgendaScreen(): JSX.Element {
  const [vue, setVue] = useState<VueAgenda>('semaine')
  const [ancre, setAncre] = useState(aujourdHui())
  const [occ, setOcc] = useState<OccurrenceDTO[]>([])
  const [categories, setCategories] = useState<CategorieDTO[]>([])
  const [modal, setModal] = useState<{ occurrence: OccurrenceDTO | null; debut: string } | null>(null)
  const [quetes, setQuetes] = useState<TacheDTO[]>([])
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)

  const plage = plageVue(vue, ancre)

  const charger = useCallback(async () => {
    setOcc(await window.api.listEvenements(plage.debut, plage.fin))
    setCategories(await window.api.listCategories())
    setQuetes(await window.api.listTaches({ statut: 'active' }))
  }, [plage.debut, plage.fin])

  useEffect(() => { charger() }, [charger])

  async function creerCategorie(nom: string, couleur: string): Promise<void> {
    await window.api.createCategorie(nom, couleur, null)
    setCategories(await window.api.listCategories())
  }

  async function valider(input: EvenementInput, mode: ModeRecurrence): Promise<void> {
    if (modal?.occurrence) await window.api.updateEvenement(modal.occurrence.masterId, modal.occurrence.dateOccurrence, mode, input)
    else await window.api.createEvenement(input)
    setModal(null); charger()
  }

  async function supprimer(mode: ModeRecurrence): Promise<void> {
    if (modal?.occurrence) await window.api.deleteEvenement(modal.occurrence.masterId, modal.occurrence.dateOccurrence, mode)
    setModal(null); charger()
  }

  async function basculerFait(o: OccurrenceDTO): Promise<void> {
    if (o.fait) {
      await window.api.annulerEvenement(o.masterId, o.dateOccurrence)
    } else {
      const res = await window.api.terminerEvenement(o.masterId, o.dateOccurrence)
      if (res.xpGagne > 0) setCelebration(res)
    }
    await charger()
  }

  function zoomJour(date: string): void { setVue('jour'); setAncre(date) }

  return (
    <div className="screen">
      <Celebration result={celebration} onClose={() => setCelebration(null)} />
      {/* Barre de navigation */}
      <div className="agenda-bar">
        <div className="row" style={{ gap: 6 }}>
          <button className="btn-icon" onClick={() => setAncre(naviguer(vue, ancre, -1))}>‹</button>
          <button className="btn-secondary" onClick={() => setAncre(aujourdHui())}>Aujourd'hui</button>
          <button className="btn-icon" onClick={() => setAncre(naviguer(vue, ancre, 1))}>›</button>
          <span className="agenda-periode">{libellePeriode(vue, ancre)}</span>
        </div>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {VUES.map((v) => (
            <button key={v.id} className={`vue-chip${vue === v.id ? ' active' : ''}`} onClick={() => setVue(v.id)}>{v.label}</button>
          ))}
        </div>
      </div>

      <RappelsPermissionBanner />

      {/* Moteur actif */}
      {(vue === 'jour' || vue === 'troisJours' || vue === 'semaine') && (
        <TimelineView
          jours={joursEntre(plage.debut, plage.fin)}
          occurrences={occ}
          onCreer={(debut) => setModal({ occurrence: null, debut })}
          onEditer={(o) => setModal({ occurrence: o, debut: o.debut })}
          onDeplacer={(o, nouveauDebut) => setModal({ occurrence: o, debut: nouveauDebut })}
          onToggleFait={basculerFait}
        />
      )}
      {vue === 'mois' && (
        <MoisView ancre={ancre} occurrences={occ}
          onCreerJour={(date) => setModal({ occurrence: null, debut: `${date} 09:00` })}
          onEditer={(o) => setModal({ occurrence: o, debut: o.debut })}
          onDeplacer={(o, date) => setModal({ occurrence: o, debut: `${date} ${o.debut.slice(11)}` })}
          onToggleFait={basculerFait} />
      )}
      {(vue === 'trimestre' || vue === 'semestre' || vue === 'neufMois' || vue === 'annee') && (
        <MultiMoisView ancre={ancre} nbMois={NB_MOIS[vue]} occurrences={occ}
          onCreerJour={(date) => setModal({ occurrence: null, debut: `${date} 09:00` })}
          onZoomJour={zoomJour} />
      )}

      {modal && (
        <EvenementModal
          occurrence={modal.occurrence} debutInitial={modal.debut}
          categories={categories} onCreerCategorie={creerCategorie}
          quetesActives={quetes}
          onToggleFait={basculerFait}
          onValider={valider} onSupprimer={supprimer} onFermer={() => setModal(null)} />
      )}
    </div>
  )
}
