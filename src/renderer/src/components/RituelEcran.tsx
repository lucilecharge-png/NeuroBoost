import { useState, type CSSProperties } from 'react'
import { getRituelTaches, setRituelTaches, type Phase } from '../data/rituels'

interface Props {
  phase: Phase
  onFermer: () => void
}

// Habillage de chaque routine (le contenu des tâches vit dans rituels.ts).
const CONTENU: Record<Phase, { emoji: string; nom: string; titre: string; sous: string; intro: string }> = {
  reveil: {
    emoji: '🌅',
    nom: 'Routine matin',
    titre: 'Réveil en douceur',
    sous: "Avant l'écran, offre à ton cerveau un vrai départ.",
    intro:
      'Scroller dès le réveil noie ton cerveau sous la dopamine et la charge mentale. Quelques minutes hors écran changent toute la journée.'
  },
  coucher: {
    emoji: '🌙',
    nom: 'Routine nuit',
    titre: 'Coucher apaisé',
    sous: 'Pose les écrans, laisse ton cerveau ralentir.',
    intro:
      "La lumière des écrans et le scroll infini retardent le sommeil et fragmentent ta récupération. Ton cerveau TDAH a besoin de cette transition."
  }
}

const PHASES: Phase[] = ['reveil', 'coucher']

export default function RituelEcran({ phase, onFermer }: Props): JSX.Element {
  const [coupe, setCoupe] = useState(false)
  // Routine affichée : on démarre sur la phase proposée, mais on peut basculer
  // entre matin et nuit pour consulter / modifier les deux.
  const [phaseActive, setPhaseActive] = useState<Phase>(phase)
  const [editer, setEditer] = useState(false)
  const [taches, setTaches] = useState<string[]>(() => getRituelTaches(phase))
  const [nouvelle, setNouvelle] = useState('')

  const c = CONTENU[phaseActive]

  function changerPhase(p: Phase): void {
    setPhaseActive(p)
    setTaches(getRituelTaches(p))
    setNouvelle('')
  }

  function persister(liste: string[]): void {
    setTaches(liste)
    setRituelTaches(phaseActive, liste)
  }

  function ajouter(): void {
    const t = nouvelle.trim()
    if (!t) return
    persister([...taches, t])
    setNouvelle('')
  }

  function supprimer(index: number): void {
    persister(taches.filter((_, i) => i !== index))
  }

  // Écran coupé : noir, presque rien — l'invitation à quitter l'écran.
  if (coupe) {
    return (
      <div
        className="focus-overlay"
        style={{ background: '#000', cursor: 'pointer' }}
        onClick={onFermer}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }}>{phaseActive === 'reveil' ? '☀️' : '😴'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#cbd5e1' }}>
          {phaseActive === 'reveil' ? 'Belle journée.' : 'Bonne nuit.'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 24 }}>Touche l'écran pour revenir</div>
      </div>
    )
  }

  // Scène volontairement sombre et immersive : on fige les jetons sombres ici
  // pour qu'elle reste lisible même quand l'app est en thème clair.
  const sceneSombre = {
    '--text': '#e7eaef',
    '--text-muted': '#aab3c2',
    '--bg-card': '#161b23',
    '--border': '#2c3442',
    '--gold': '#bd9a5d',
    color: '#e7eaef',
    background:
      phaseActive === 'reveil'
        ? 'radial-gradient(ellipse at 50% 30%, rgb(48,36,12), rgb(3,11,20))'
        : 'radial-gradient(ellipse at 50% 30%, rgb(26,18,48), rgb(3,11,20))'
  } as CSSProperties

  return (
    <div className="focus-overlay" style={sceneSombre}>
      {/* Sélecteur de routine : matin / nuit */}
      <div style={{ display: 'flex', gap: 8, padding: 4, background: 'rgba(255,255,255,.05)', borderRadius: 999 }}>
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => changerPhase(p)}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: p === phaseActive ? 'rgba(255,255,255,.14)' : 'transparent',
              color: p === phaseActive ? '#f4f6fa' : '#aab3c2'
            }}
          >
            {CONTENU[p].emoji} {CONTENU[p].nom}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 64, marginBottom: 4 }}>{c.emoji}</div>
      <div className="focus-titre" style={{ color: '#f4f6fa' }}>{c.titre}</div>
      <div style={{ textAlign: 'center', maxWidth: 420, marginBottom: 6, color: '#aab3c2' }}>{c.sous}</div>

      <div style={{ maxWidth: 440, textAlign: 'center', fontSize: 13, lineHeight: 1.7, color: '#aab3c2', marginBottom: 22, fontStyle: 'italic' }}>
        {c.intro}
      </div>

      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {taches.map((t, i) => (
          <div
            key={`${t}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 18px',
              background: '#161b23',
              border: '1px solid #2c3442',
              borderRadius: 'var(--radius)',
              fontSize: 15,
              color: '#e7eaef'
            }}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>{t}</span>
            {editer && (
              <button
                onClick={() => supprimer(i)}
                aria-label="Supprimer la tâche"
                style={{
                  flexShrink: 0,
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  border: '1px solid #3a4150',
                  background: 'transparent',
                  color: '#e98b86',
                  fontSize: 16,
                  lineHeight: 1,
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}

        {editer && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={nouvelle}
              onChange={(e) => setNouvelle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ajouter()
              }}
              placeholder="Ajouter une tâche…"
              style={{
                flex: 1,
                padding: '12px 14px',
                background: '#10151c',
                border: '1px solid #2c3442',
                borderRadius: 'var(--radius)',
                color: '#e7eaef',
                fontSize: 14
              }}
            />
            <button
              onClick={ajouter}
              disabled={!nouvelle.trim()}
              style={{
                flexShrink: 0,
                padding: '0 16px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(135,164,210,.35)',
                background: '#43618f',
                color: '#eaf0f8',
                fontSize: 14,
                fontWeight: 600,
                cursor: nouvelle.trim() ? 'pointer' : 'default',
                opacity: nouvelle.trim() ? 1 : 0.5
              }}
            >
              Ajouter
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setEditer((v) => !v)}
        style={{
          marginBottom: 8,
          background: 'transparent',
          border: 'none',
          color: '#aab3c2',
          fontSize: 13,
          textDecoration: 'underline',
          cursor: 'pointer'
        }}
      >
        {editer ? '✓ Terminer la modification' : '✏️ Modifier les tâches'}
      </button>

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
