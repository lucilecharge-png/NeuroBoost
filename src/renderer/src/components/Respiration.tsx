import { useEffect, useRef, useState } from 'react'

export interface RespirationPhase {
  label: string
  ms: number
  scale: number
}

export interface RespirationConfig {
  titre: string
  cycles: number
  phases: RespirationPhase[]
  gradient: string
  accent: string
}

interface Props {
  config: RespirationConfig
  onFermer: () => void
}

// Animation de respiration guidée : un cercle qui gonfle (inspire) et se rétracte
// (expire) au rythme de chaque phase. Le timing vient de la config, le mouvement
// est une simple transition CSS sur `transform: scale(...)`.
export default function Respiration({ config, onFermer }: Props): JSX.Element {
  const [started, setStarted] = useState(false)
  const [cycle, setCycle] = useState(1)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [fini, setFini] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const phase = config.phases[phaseIdx]

  // Petit temps de préparation avant de démarrer le premier cycle.
  useEffect(() => {
    const t = window.setTimeout(() => setStarted(true), 1000)
    return () => window.clearTimeout(t)
  }, [])

  // Avance de phase en phase, puis de cycle en cycle, jusqu'à la fin.
  useEffect(() => {
    if (!started || fini) return
    timer.current = window.setTimeout(() => {
      if (phaseIdx + 1 < config.phases.length) {
        setPhaseIdx(phaseIdx + 1)
      } else if (cycle < config.cycles) {
        setCycle(cycle + 1)
        setPhaseIdx(0)
      } else {
        setFini(true)
      }
    }, phase.ms)
    return () => window.clearTimeout(timer.current)
  }, [started, phaseIdx, cycle, fini, config.phases.length, config.cycles, phase.ms])

  const auRepos = !started || fini
  const scale = auRepos ? 0.85 : phase.scale
  const duree = started && !fini ? phase.ms : 700
  const label = fini ? 'Terminé' : started ? phase.label : 'Prépare-toi…'

  return (
    <div
      className="focus-overlay"
      style={{ background: 'radial-gradient(ellipse at 50% 35%, #131826, #05080f)', color: '#e7eaef' }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: config.accent, letterSpacing: 0.5 }}>{config.titre}</div>

      <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: config.gradient,
            boxShadow: `0 0 60px ${config.accent}66`,
            transform: `scale(${scale})`,
            transition: `transform ${duree}ms ease-in-out`,
            opacity: fini ? 0.5 : 1
          }}
        />
        <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{fini ? '🎉' : label}</div>
          {!fini && started && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 4 }}>
              Cycle {cycle} / {config.cycles}
            </div>
          )}
        </div>
      </div>

      {fini ? (
        <button className="btn-launch" style={{ maxWidth: 260 }} onClick={onFermer}>
          Revenir à la routine
        </button>
      ) : (
        <button
          onClick={onFermer}
          style={{ background: 'transparent', border: 'none', color: '#aab3c2', fontSize: 13, textDecoration: 'underline', cursor: 'pointer' }}
        >
          Arrêter
        </button>
      )}
    </div>
  )
}
