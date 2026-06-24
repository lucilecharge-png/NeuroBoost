import { useState, useEffect, useRef } from 'react'
import type { RecompenseDTO } from '../../../shared/types'

// ── Sons Web Audio API ─────────────────────────────────────────────────────

type SonId = 'cloche' | 'carillon' | 'gong' | 'bip' | 'melodie'
interface Son { id: SonId; label: string; icone: string; play: () => void }

function ctx() {
  return new AudioContext()
}

function playCloche() {
  const c = ctx()
  const osc = c.createOscillator(); const g = c.createGain()
  osc.connect(g); g.connect(c.destination)
  osc.type = 'sine'; osc.frequency.value = 528
  g.gain.setValueAtTime(0.5, c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 3)
  osc.start(); osc.stop(c.currentTime + 3)
  setTimeout(() => c.close(), 3500)
}

function playCarillon() {
  const c = ctx()
  ;[523, 659, 784].forEach((freq, i) => {
    const osc = c.createOscillator(); const g = c.createGain()
    osc.connect(g); g.connect(c.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = c.currentTime + i * 0.28
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5)
    osc.start(t); osc.stop(t + 1.5)
  })
  setTimeout(() => c.close(), 2500)
}

function playGong() {
  const c = ctx()
  ;[80, 160, 320].forEach((freq, i) => {
    const osc = c.createOscillator(); const g = c.createGain()
    osc.connect(g); g.connect(c.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    g.gain.setValueAtTime(i === 0 ? 0.5 : 0.18, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 4.5)
    osc.start(); osc.stop(c.currentTime + 4.5)
  })
  setTimeout(() => c.close(), 5000)
}

function playBip() {
  const c = ctx()
  ;[880, 1320].forEach((freq, i) => {
    const osc = c.createOscillator(); const g = c.createGain()
    osc.connect(g); g.connect(c.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = c.currentTime + i * 0.35
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.start(t); osc.stop(t + 0.3)
  })
  setTimeout(() => c.close(), 1000)
}

function playMelodie() {
  const c = ctx()
  ;[392, 440, 523, 587, 784].forEach((freq, i) => {
    const osc = c.createOscillator(); const g = c.createGain()
    osc.connect(g); g.connect(c.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    const t = c.currentTime + i * 0.2
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55)
    osc.start(t); osc.stop(t + 0.55)
  })
  setTimeout(() => c.close(), 2200)
}

const SONS: Son[] = [
  { id: 'cloche',   label: 'Cloche zen',    icone: '🔔', play: playCloche },
  { id: 'carillon', label: 'Carillon',       icone: '🎵', play: playCarillon },
  { id: 'gong',     label: 'Gong',           icone: '🪘', play: playGong },
  { id: 'bip',      label: 'Bip double',     icone: '📯', play: playBip },
  { id: 'melodie',  label: 'Mélodie',        icone: '🎶', play: playMelodie },
]

// ── Helpers ────────────────────────────────────────────────────────────────

const PRESETS = [5, 10, 15, 25, 45, 60]

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

type Phase = 'config' | 'running' | 'paused' | 'done'

// ── Composant ──────────────────────────────────────────────────────────────

export default function TimerScreen(): JSX.Element {
  const [dureeMin, setDureeMin] = useState(25)
  const [dureeLibre, setDureeLibre] = useState('')
  const [sonId, setSonId] = useState<SonId>('cloche')
  const [phase, setPhase] = useState<Phase>('config')
  const [remaining, setRemaining] = useState(25 * 60)
  const [recompenses, setRecompenses] = useState<RecompenseDTO[]>([])
  const [showRecoPanel, setShowRecoPanel] = useState(false)
  const [recoChoisie, setRecoChoisie] = useState<RecompenseDTO | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const dureeActive = dureeLibre ? Math.max(1, parseInt(dureeLibre) || 1) : dureeMin
  const totalSec = dureeActive * 60
  const isOvertime = remaining < 0
  const pct = phase === 'config' ? 0 : isOvertime ? 1 : Math.max(0, 1 - remaining / totalSec)

  useEffect(() => {
    window.api.listRecompenses().then(r => setRecompenses(r.filter(x => !x.utilisee)))
  }, [])

  useEffect(() => {
    if (phase === 'running') {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          const next = r - 1
          // Passage à zéro : son + panneau récompenses
          if (r === 1) {
            SONS.find(s => s.id === sonId)?.play()
            setShowRecoPanel(true)
          }
          // Son répété toutes les 60s en temps négatif
          if (next < 0 && next % 60 === 0) {
            SONS.find(s => s.id === sonId)?.play()
          }
          return next
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [phase, sonId])

  function demarrer() {
    setRemaining(dureeActive * 60)
    setPhase('running')
    setRecoChoisie(null)
    setShowRecoPanel(false)
  }

  function togglePause() {
    setPhase(p => p === 'running' ? 'paused' : 'running')
  }

  function reset() {
    setPhase('config')
    setShowRecoPanel(false)
    setRecoChoisie(null)
  }

  async function prendreCette(r: RecompenseDTO) {
    await window.api.acheterRecompense(r.id)
    setRecoChoisie(r)
    setShowRecoPanel(false)
    setRecompenses(prev => prev.filter(x => x.id !== r.id))
  }

  const radius = 110
  const circ = 2 * Math.PI * radius

  return (
    <div className="screen" style={{ maxWidth: 600 }}>
      <div className="screen-title">Timer</div>
      <div className="screen-subtitle">Concentre-toi. Quand c'est fini, tu mérites une pause.</div>

      {/* ── Grand cercle timer ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, marginTop: 20 }}>
        <div style={{ position: 'relative', width: 260, height: 260 }}>
          <svg width="260" height="260" viewBox="0 0 260 260">
            <defs>
              <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--green)" />
              </linearGradient>
              <filter id="glow-timer">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* Fond */}
            <circle cx="130" cy="130" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
            {/* Arc de progression */}
            <circle
              cx="130" cy="130" r={radius}
              fill="none"
              stroke={isOvertime ? 'var(--danger)' : 'url(#tg)'}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct)}
              filter={phase === 'running' ? 'url(#glow-timer)' : undefined}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '130px 130px',
                transition: phase === 'running' ? 'stroke-dashoffset 1s linear' : 'none'
              }}
            />
          </svg>

          {/* Texte central */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>
            <div style={{
              fontSize: phase === 'config' ? 40 : 52,
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -3,
              color: isOvertime ? 'var(--danger)' : 'var(--text)',
              lineHeight: 1,
              transition: 'color 400ms'
            }}>
              {phase === 'config'
                ? fmtTime(dureeActive * 60)
                : isOvertime
                  ? `-${fmtTime(Math.abs(remaining))}`
                  : fmtTime(remaining)}
            </div>
            <div style={{ fontSize: 11, color: isOvertime ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {phase === 'config' ? `${dureeActive} min` :
               isOvertime        ? 'dépassé' :
               phase === 'running' ? 'en cours' :
               phase === 'paused'  ? '⏸ pause' :
                                     '✓ terminé'}
            </div>
          </div>
        </div>

        {/* ── Configuration ── */}
        {phase === 'config' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Presets durée */}
            <div>
              <div className="section-header">Durée</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRESETS.map(p => (
                  <button key={p}
                    className={dureeMin === p && !dureeLibre ? 'btn-primary' : 'btn-ghost'}
                    style={{ flex: 1, minWidth: 64 }}
                    onClick={() => { setDureeMin(p); setDureeLibre('') }}>
                    {p} min
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  className="input"
                  type="number" min={1} max={180}
                  placeholder="Durée personnalisée..."
                  value={dureeLibre}
                  onChange={e => setDureeLibre(e.target.value)}
                  style={{ textAlign: 'center' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>min</span>
              </div>
            </div>

            {/* Sélecteur sons */}
            <div>
              <div className="section-header">Son de fin — clique pour écouter</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {SONS.map(s => (
                  <button key={s.id}
                    onClick={() => { setSonId(s.id); s.play() }}
                    style={{
                      flex: 1,
                      padding: '12px 4px',
                      borderRadius: 'var(--radius)',
                      background: sonId === s.id ? 'rgba(14,165,233,.12)' : 'var(--bg-card)',
                      border: `1px solid ${sonId === s.id ? 'rgba(14,165,233,.4)' : 'var(--border)'}`,
                      color: sonId === s.id ? 'var(--accent-glow)' : 'var(--text-muted)',
                      boxShadow: sonId === s.id ? 'var(--glow-blue)' : 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      cursor: 'pointer', transition: 'all 150ms',
                    }}>
                    <span style={{ fontSize: 26 }}>{s.icone}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5 }}>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="btn-launch" onClick={demarrer}>
              ▶ Lancer le timer
            </button>
          </div>
        )}

        {/* ── Contrôles running/paused ── */}
        {phase !== 'config' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* Bouton STOP rouge bien visible en dépassement */}
            {isOvertime && (
              <button onClick={reset} style={{
                padding: '14px 40px', borderRadius: 'var(--radius)',
                background: 'var(--danger)', color: '#fff',
                fontSize: 16, fontWeight: 900, letterSpacing: .5,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 0 28px rgba(239,68,68,.5)',
                animation: 'levelup-pulse 1.5s ease-in-out infinite',
              }}>
                ■ Arrêter le timer
              </button>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {!isOvertime && (
                <button className="btn-primary"
                  style={{ minWidth: 140, padding: '12px 24px', fontSize: 15, fontWeight: 800 }}
                  onClick={togglePause}>
                  {phase === 'running' ? '⏸ Pause' : '▶ Reprendre'}
                </button>
              )}
              <button className="btn-ghost" onClick={reset}>
                ↩ Recommencer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Récompense choisie ── */}
      {recoChoisie && (
        <div style={{
          marginTop: 28,
          padding: '20px 24px',
          background: 'rgba(16,185,129,.07)',
          border: '1px solid rgba(16,185,129,.3)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
        }}>
          <div style={{ fontSize: 44 }}>{recoChoisie.icone}</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Récompense méritée</div>
          <div style={{ color: 'var(--green-glow)', fontWeight: 700, fontSize: 15 }}>{recoChoisie.titre}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 320 }}>
            Profites-en pleinement et sans culpabilité. Tu l'as gagné.
          </div>
        </div>
      )}

      {/* ── Panneau choix récompense ── */}
      {showRecoPanel && (
        <div style={{ marginTop: 28 }}>
          <div className="section-header" style={{ marginBottom: 12 }}>
            Timer terminé — choisis ta récompense
          </div>
          {recompenses.length === 0 ? (
            <div className="empty-state">
              Toutes tes récompenses disponibles ont été utilisées.<br />
              Ajoutes-en de nouvelles dans l'onglet Récompenses.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recompenses.map(r => (
                <button key={r.id} onClick={() => prendreCette(r)}
                  className="mission-card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', textAlign: 'left',
                    cursor: 'pointer', width: '100%', color: 'var(--text)',
                  }}>
                  <span style={{ fontSize: 30 }}>{r.icone}</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{r.titre}</span>
                  <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {r.coutCoins} 🪙
                  </span>
                </button>
              ))}
              <button className="btn-ghost" style={{ marginTop: 4 }}
                onClick={() => setShowRecoPanel(false)}>
                Passer — je choisirai plus tard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
