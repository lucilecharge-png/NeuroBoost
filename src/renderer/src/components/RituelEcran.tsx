import { useState } from 'react'
import type { Phase } from '../data/rituels'

interface Props {
  phase: Phase
  onFermer: () => void
}

const CONTENU: Record<Phase, { emoji: string; titre: string; sous: string; rituels: string[]; intro: string }> = {
  reveil: {
    emoji: '🌅',
    titre: 'Réveil en douceur',
    sous: 'Avant l\'écran, offre à ton cerveau un vrai départ.',
    intro: "Scroller dès le réveil noie ton cerveau sous la dopamine et la charge mentale. Quelques minutes hors écran changent toute la journée.",
    rituels: [
      '💧 Bois un grand verre d\'eau',
      '🌬️ Respire profondément 5 fois',
      '🤸 Étire-toi 2 minutes',
      '✍️ Écris une seule intention pour aujourd\'hui'
    ]
  },
  coucher: {
    emoji: '🌙',
    titre: 'Coucher apaisé',
    sous: 'Pose les écrans, laisse ton cerveau ralentir.',
    intro: "La lumière des écrans et le scroll infini retardent le sommeil et fragmentent ta récupération. Ton cerveau TDAH a besoin de cette transition.",
    rituels: [
      '📵 Range ton téléphone hors de portée',
      '🌬️ Respire lentement, 5 cycles',
      '🏆 Note une victoire de ta journée',
      '🔅 Tamise les lumières'
    ]
  }
}

export default function RituelEcran({ phase, onFermer }: Props): JSX.Element {
  const [coupe, setCoupe] = useState(false)
  const c = CONTENU[phase]

  // Écran coupé : noir, presque rien — l'invitation à quitter l'écran.
  if (coupe) {
    return (
      <div
        className="focus-overlay"
        style={{ background: '#000', cursor: 'pointer' }}
        onClick={onFermer}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }}>{phase === 'reveil' ? '☀️' : '😴'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#cbd5e1' }}>
          {phase === 'reveil' ? 'Belle journée.' : 'Bonne nuit.'}
        </div>
        <div style={{ color: '#475569', fontSize: 13, marginTop: 24 }}>Touche l'écran pour revenir</div>
      </div>
    )
  }

  return (
    <div className="focus-overlay" style={{ background: phase === 'reveil'
      ? 'radial-gradient(ellipse at 50% 30%, rgb(48,36,12), rgb(3,11,20))'
      : 'radial-gradient(ellipse at 50% 30%, rgb(26,18,48), rgb(3,11,20))' }}>
      <div style={{ fontSize: 64, marginBottom: 8 }}>{c.emoji}</div>
      <div className="focus-titre">{c.titre}</div>
      <div className="text-muted" style={{ textAlign: 'center', maxWidth: 420, marginBottom: 6 }}>{c.sous}</div>

      <div style={{ maxWidth: 440, textAlign: 'center', fontSize: 13, lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 22, fontStyle: 'italic' }}>
        {c.intro}
      </div>

      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {c.rituels.map((r) => (
          <div
            key={r}
            style={{ padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 15 }}
          >
            {r}
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn-launch" onClick={() => setCoupe(true)}>
          🌑 Couper l'écran
        </button>
        <button className="btn-ghost" onClick={onFermer}>
          Entrer dans l'app
        </button>
      </div>
    </div>
  )
}
