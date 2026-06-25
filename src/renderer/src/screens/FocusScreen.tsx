import { useState, useEffect, useRef } from 'react'
import type { TacheDTO } from '../../../shared/types'

interface Props {
  tache: TacheDTO
  onTerminer: (dureeReelleMin: number) => Promise<void>
  onAbandonner: () => void
}

type Phase = 'choix-duree' | 'en-cours' | 'bloque' | 'fini' | 'post-it' | 'pause-corpo'

const DUREES = [
  { label: '2 min', subtitle: 'Mode chrysalide 🦋', min: 2 },
  { label: '5 min', subtitle: 'Démarrage doux', min: 5 },
  { label: '15 min', subtitle: 'Session courte', min: 15 },
  { label: '25 min', subtitle: 'Pomodoro', min: 25 }
]

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const CORPO_PAUSE_THRESHOLD_S = 25 * 60

const MICRO_STEPS = [
  "Ouvre juste le fichier / l'application",
  'Lis les 3 premières lignes',
  'Pose un seul objet sur ta table',
  'Écris le titre de la tâche quelque part',
  'Mets ton téléphone hors de portée'
]

export default function FocusScreen({ tache, onTerminer, onAbandonner }: Props): JSX.Element {
  const [phase, setPhase] = useState<Phase>('choix-duree')
  const [dureePrevue, setDureePrevue] = useState(5)
  const [remaining, setRemaining] = useState(0)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [debutMs, setDebutMs] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [microStep] = useState(() => MICRO_STEPS[Math.floor(Math.random() * MICRO_STEPS.length)])
  const [totalFocusMin, setTotalFocusMin] = useState(0)
  const [alerteEnergieIgnoree, setAlerteEnergieIgnoree] = useState(false)
  const [postItNote, setPostItNote] = useState('')
  const [phaseAvantPostIt, setPhaseAvantPostIt] = useState<Phase>('en-cours')
  const [elapsedS, setElapsedS] = useState(0)
  const corpoPauseTriggered = useRef(false)

  function demarrer(min: number) {
    setDureePrevue(min)
    setRemaining(min * 60)
    setPhase('en-cours')
    setDebutMs(Date.now())
    setElapsedS(0)
    corpoPauseTriggered.current = false
    window.api.demarrerSession(tache.id, min).then((s) => setSessionId(s.id))
  }

  useEffect(() => {
    if (phase !== 'en-cours') return
    intervalRef.current = setInterval(() => {
      setElapsedS((e) => e + 1)
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          setPhase('fini')
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'en-cours') return
    if (dureePrevue < 25) return
    if (elapsedS < CORPO_PAUSE_THRESHOLD_S) return
    if (corpoPauseTriggered.current) return
    corpoPauseTriggered.current = true
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPhase('pause-corpo')
  }, [elapsedS, phase, dureePrevue])

  useEffect(() => {
    window.api.listSessionsAujourdHui().then((sessions) => {
      const total = sessions
        .filter((s) => s.completee && s.dureeReelleMin !== null)
        .reduce((sum, s) => sum + (s.dureeReelleMin ?? 0), 0)
      setTotalFocusMin(total)
    }).catch(console.error)
  }, [])

  async function terminer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    const dureeReelle = Math.round((Date.now() - debutMs) / 60000)
    if (sessionId) await window.api.terminerSession(sessionId, true, Math.max(1, dureeReelle))
    await onTerminer(Math.max(1, dureeReelle))
  }

  function allerAuPostIt() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPhaseAvantPostIt(phase)
    setPhase('post-it')
  }

  async function executerAbandon() {
    // debutMs is set once in demarrer() and never changes — safe to read in closure
    const dureeReelle = Math.round((Date.now() - debutMs) / 60000)
    if (sessionId && phaseAvantPostIt === 'en-cours') {
      await window.api.terminerSession(sessionId, false, Math.max(1, dureeReelle))
    }
    onAbandonner()
  }

  async function confirmerPostIt() {
    if (postItNote.trim()) {
      await window.api.addCapture(`📝 ${tache.titre} — ${postItNote.trim()}`)
    }
    await executerAbandon()
  }

  function reprendreFocus() {
    corpoPauseTriggered.current = false
    setElapsedS(0)
    setPhase('en-cours')
  }

  async function abandonner() {
    if (phase === 'en-cours' || phase === 'fini') {
      allerAuPostIt()
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (sessionId) {
        const dureeReelle = Math.round((Date.now() - debutMs) / 60000)
        await window.api.terminerSession(sessionId, false, Math.max(1, dureeReelle))
      }
      onAbandonner()
    }
  }

  const montrerAlerteEnergie =
    phase === 'choix-duree' &&
    !alerteEnergieIgnoree &&
    totalFocusMin >= 240

  // ─── Pause Corpo ──────────────────────────────────────────────────────────
  if (phase === 'pause-corpo') {
    return (
      <div className="focus-overlay">
        <div style={{ fontSize: 64, marginBottom: 8 }}>🧘</div>
        <div className="focus-titre">Pause Corpo !</div>
        <div className="text-muted" style={{ textAlign: 'center', maxWidth: 380, marginBottom: 24 }}>
          Tu focus depuis 25 min — prends 2 minutes pour toi. Le timer t'attend.
        </div>
        <div style={{ width: '100%', maxWidth: 380, marginBottom: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              '🦵 Lève-toi et étire les jambes',
              '💧 Bois un verre d\'eau',
              '👀 Regarde au loin 20 secondes'
            ].map((s, i) => (
              <div
                key={i}
                style={{ padding: '14px 18px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 'var(--radius)', fontSize: 15 }}
              >
                {s}
              </div>
            ))}
          </div>
        </div>
        <button className="btn-launch" style={{ fontSize: 17 }} onClick={reprendreFocus}>
          ✓ Pause faite, je reprends
        </button>
      </div>
    )
  }

  // ─── Post-it de transition ────────────────────────────────────────────────
  if (phase === 'post-it') {
    return (
      <div className="focus-overlay">
        <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
        <div className="focus-titre" style={{ maxWidth: 480 }}>Avant de partir…</div>
        <div className="text-muted" style={{ textAlign: 'center', maxWidth: 400, marginBottom: 20 }}>
          Laisse une note à ton futur toi. Où en étais-tu ? Quelle est la prochaine étape ?
        </div>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <textarea
            className="textarea"
            style={{ minHeight: 100, fontSize: 14, marginBottom: 12 }}
            placeholder={`Ex : "J'en étais à la partie intro, la prochaine étape est de rédiger la section 2"`}
            value={postItNote}
            onChange={(e) => setPostItNote(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn-launch" onClick={confirmerPostIt}>
              💾 Sauvegarder et partir
            </button>
            <button className="btn-ghost" onClick={executerAbandon}>
              Passer (quitter sans noter)
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Choix de durée ───────────────────────────────────────────────────────
  if (phase === 'choix-duree') {
    return (
      <div className="focus-overlay">
        {/* No session started yet — skip post-it, go straight to accueil */}
        <button className="btn-ghost" style={{ position: 'absolute', top: 20, left: 20, fontSize: 13 }} onClick={onAbandonner}>
          ← Retour
        </button>
        {montrerAlerteEnergie && (
          <div style={{ width: '100%', maxWidth: 440, padding: '16px', background: 'rgba(239,68,68,.1)', border: '2px solid rgba(239,68,68,.4)', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#ef4444', marginBottom: 8 }}>
              🔋 Alerte Énergie
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
              Tu as déjà {totalFocusMin} minutes de focus aujourd'hui. Continuer risque de vider ta batterie pour demain. Ton cerveau TDAH a besoin de récupération.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13 }}
                onClick={onAbandonner}
              >
                ← M'arrêter ici
              </button>
              <button
                className="btn-ghost"
                style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}
                onClick={() => setAlerteEnergieIgnoree(true)}
              >
                Je comprends, je continue
              </button>
            </div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⏱</div>
          <div className="focus-titre">{tache.titre}</div>
          {tache.description && <div className="text-muted" style={{ marginTop: 6 }}>{tache.description}</div>}
        </div>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: 14, color: 'var(--text-muted)' }}>
            Pour combien de temps tu t'engages ?
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            {DUREES.map((d) => (
              <button
                key={d.min}
                onClick={() => demarrer(d.min)}
                style={{
                  padding: '18px 12px',
                  borderRadius: 'var(--radius-lg)',
                  background: d.min === 2 ? 'linear-gradient(135deg, var(--accent), var(--green))' : 'var(--bg-card)',
                  border: `2px solid ${d.min === 2 ? 'transparent' : 'var(--border)'}`,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  boxShadow: d.min === 2 ? 'var(--shadow-lg)' : 'none'
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 900 }}>{d.label}</span>
                <span style={{ fontSize: 11, color: d.min === 2 ? 'rgba(255,255,255,.8)' : 'var(--text-muted)' }}>{d.subtitle}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, marginBottom: 4 }}>💡 Pour commencer facilement :</div>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{microStep}</div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Timer circulaire ──────────────────────────────────────────────────────
  if (phase === 'en-cours' || phase === 'bloque') {
    const total = dureePrevue * 60
    const pct = remaining / total
    const r = 88
    const circ = 2 * Math.PI * r
    const dash = circ * pct

    return (
      <div className="focus-overlay">
        <div className="focus-titre" style={{ maxWidth: 560 }}>{tache.titre}</div>

        <div className="focus-timer-wrap">
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="100" cy="100" r={r}
              fill="none"
              stroke="url(#timerGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: 'stroke-dasharray 1s linear' }}
            />
            <defs>
              <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--green)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="focus-timer-text">
            <div className="focus-timer-time">{fmtTime(remaining)}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>{dureePrevue} min</div>
          </div>
        </div>

        {phase === 'bloque' ? (
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--gold)' }}>
              💬 C'est normal de bloquer. Quelle est la TOUTE PREMIÈRE chose à faire ?
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Même si ça prend 30 secondes. Un seul geste.
            </div>
            <button className="btn-launch" onClick={() => setPhase('en-cours')}>
              ▶ Je reprends
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}>
            <button className="btn-launch" style={{ fontSize: 18, padding: '16px 24px' }} onClick={terminer}>
              🎉 C'EST FAIT !
            </button>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setPhase('bloque')}>
                😵 Je bloque
              </button>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={abandonner}>
                ✕ Abandonner
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Timer terminé ─────────────────────────────────────────────────────────
  return (
    <div className="focus-overlay">
      <div style={{ fontSize: 80, marginBottom: 8 }}>⏰</div>
      <div style={{ fontSize: 26, fontWeight: 900, textAlign: 'center' }}>Temps écoulé !</div>
      <div className="text-muted" style={{ textAlign: 'center', maxWidth: 360 }}>
        Tu as tenu {dureePrevue} minutes. Est-ce que la tâche est terminée ?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 380 }}>
        <button className="btn-launch" style={{ fontSize: 18 }} onClick={terminer}>
          🎉 OUI, c'est fait !
        </button>
        <button className="btn-ghost" onClick={() => { setRemaining(5 * 60); setElapsedS(0); corpoPauseTriggered.current = false; setPhase('en-cours') }}>
          ⏱ +5 min de plus
        </button>
        <button className="btn-ghost" onClick={abandonner}>
          ← Retour sans compléter
        </button>
      </div>
    </div>
  )
}
