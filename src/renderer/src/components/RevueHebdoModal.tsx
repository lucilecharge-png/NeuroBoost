import { useState, useEffect, useMemo } from 'react'
import type { RevueReponse } from '../../../shared/types'

export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const QUESTIONS = [
  { id: 1, label: 'Combien de tâches tu as terminées cette semaine ?', type: 'text' as const, prefill: true },
  { id: 2, label: 'Quelle est ta plus grande victoire de la semaine ?', type: 'text' as const, prefill: false },
  { id: 3, label: "Qu'est-ce qui t'a le plus freiné ?", type: 'text' as const, prefill: false },
  { id: 4, label: 'Quelle habitude tu veux renforcer la semaine prochaine ?', type: 'text' as const, prefill: false },
  { id: 5, label: 'Note ton énergie globale (1-5 ⚡)', type: 'energie' as const, prefill: false }
]

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function RevueHebdoModal({ onClose, onSaved }: Props): JSX.Element {
  const semaine = useMemo(() => getISOWeek(new Date()), [])
  const [step, setStep] = useState(0)
  const [reponses, setReponses] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [celebrer, setCelebrer] = useState(false)
  const [revueExistante, setRevueExistante] = useState(false)

  useEffect(() => {
    window.api.getRevueHebdo(semaine).then((revue) => {
      if (revue) {
        setRevueExistante(true)
        const existing: Record<number, string> = {}
        revue.reponses.forEach((r) => { existing[r.questionId] = r.reponse })
        setReponses(existing)
        // Revue existante : ne pas écraser la réponse Q1 avec getStats
        return
      }
      // Pas de revue existante : pré-remplir Q1 depuis les stats
      window.api.getStats().then((stats) => {
        setReponses((r) => ({ ...r, 1: String(stats.tachesTotalSemaine ?? 0) }))
      }).catch(console.error)
    }).catch(console.error)
  }, [semaine])

  function repondre(questionId: number, valeur: string) {
    setReponses((r) => ({ ...r, [questionId]: valeur }))
  }

  async function sauvegarder() {
    setSaving(true)
    const reponsesArray: RevueReponse[] = QUESTIONS.map((q) => ({
      questionId: q.id,
      reponse: reponses[q.id] ?? ''
    }))
    await window.api.saveRevueHebdo(semaine, reponsesArray)
    setSaving(false)
    if (!revueExistante) setCelebrer(true)
    setTimeout(() => {
      onSaved()
      onClose()
    }, 2500)
  }

  const q = QUESTIONS[step]
  const reponse = reponses[q.id] ?? ''

  if (celebrer) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '40px 32px', textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 900, fontSize: 20, color: 'var(--accent)', marginBottom: 8 }}>
            +100 XP
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            Revue de la semaine complétée !
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Bien joué — tu prends soin de toi 🌱
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', width: '100%', maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>
            📅 Revue {semaine}{revueExistante ? ' (déjà faite)' : ''}
          </div>
          <button className="btn-ghost" style={{ fontSize: 18, padding: '2px 8px' }} onClick={onClose}>✕</button>
        </div>

        {/* Barre de progression */}
        <div style={{ height: 4, background: 'rgba(255,255,255,.1)', borderRadius: 4, marginBottom: 20 }}>
          <div style={{ height: 4, background: 'var(--accent)', borderRadius: 4, width: `${((step + 1) / QUESTIONS.length) * 100}%`, transition: 'width .3s' }} />
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          Question {step + 1}/{QUESTIONS.length}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{q.label}</div>

        {q.type === 'energie' ? (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {['1 ⚡', '2 ⚡', '3 ⚡', '4 ⚡', '5 ⚡'].map((v, i) => (
              <button
                key={i}
                type="button"
                className={reponse === String(i + 1) ? 'btn-launch' : 'btn-ghost'}
                style={{ flex: 1, fontSize: 13, padding: '10px 4px' }}
                onClick={() => repondre(q.id, String(i + 1))}
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            className="textarea"
            style={{ width: '100%', minHeight: 80, fontSize: 14, marginBottom: 16 }}
            value={reponse}
            onChange={(e) => repondre(q.id, e.target.value)}
            placeholder="Ta réponse..."
            autoFocus
          />
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>
              ← Précédent
            </button>
          )}
          {step < QUESTIONS.length - 1 ? (
            <button className="btn-launch" style={{ flex: 1 }} onClick={() => setStep(step + 1)}>
              Suivant →
            </button>
          ) : (
            <button className="btn-launch" style={{ flex: 1 }} disabled={saving} onClick={sauvegarder}>
              {saving ? 'Sauvegarde…' : '✓ Terminer la revue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
