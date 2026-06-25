import { useState } from 'react'
import type { TacheDTO } from '../../../shared/types'

interface Excuse {
  label: string
  reframe: string
}

// Les "mensonges courants" qu'on se raconte au moment de reporter — chacun
// désamorcé par un recadrage court et actionnable.
const EXCUSES: Excuse[] = [
  {
    label: "Je n'ai pas le temps",
    reframe: "« Pas le temps » veut souvent dire « pas la priorité ». Accorde-lui juste 2 minutes — pas la tâche entière. 2 minutes, tu les as."
  },
  {
    label: 'Je ne suis pas d\'humeur / pas motivé·e',
    reframe: "La motivation vient APRÈS l'action, pas avant. Commence par le plus petit geste et l'envie suivra souvent toute seule."
  },
  {
    label: "C'est trop gros, je sais pas par où commencer",
    reframe: "Tu n'as pas à tout faire. Quelle est la TOUTE première micro-étape ? Ouvrir le fichier ? Écrire une ligne ? Fais juste ça."
  },
  {
    label: "J'ai peur de mal faire",
    reframe: "Une version imparfaite battra toujours une version qui n'existe pas. Tu pourras corriger après — mais il faut d'abord commencer."
  },
  {
    label: "Je le ferai plus tard / demain",
    reframe: "Le « toi de plus tard » sera aussi fatigué que maintenant — et en plus, en retard. 2 minutes maintenant lui font un énorme cadeau."
  }
]

interface Props {
  tache: TacheDTO
  onSyMettre: () => void
  onReporter: () => void
  onClose: () => void
}

export default function ExcuseBusterModal({ tache, onSyMettre, onReporter, onClose }: Props): JSX.Element {
  const [choisie, setChoisie] = useState<Excuse | null>(null)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🛑 Avant de reporter…</div>
          <button className="btn-ghost" style={{ fontSize: 20, padding: '2px 8px' }} onClick={onClose}>✕</button>
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
          « {tache.titre} » — qu'est-ce qui te bloque vraiment, là, maintenant ?
        </div>

        {!choisie ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EXCUSES.map((ex) => (
              <button
                key={ex.label}
                className="btn-ghost"
                style={{ textAlign: 'left', fontSize: 14, padding: '12px 14px', fontWeight: 600 }}
                onClick={() => setChoisie(ex)}
              >
                {ex.label}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(124,58,237,.1)',
                border: '1px solid rgba(124,58,237,.3)',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                lineHeight: 1.7,
                marginBottom: 16
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--accent-glow)', marginBottom: 6 }}>💬 {choisie.label}</div>
              {choisie.reframe}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-launch" onClick={onSyMettre}>
                🚀 OK, je m'y mets 2 minutes
              </button>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => setChoisie(null)}>
                  ← Autre raison
                </button>
                <button className="btn-ghost" style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }} onClick={onReporter}>
                  Reporter quand même
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
