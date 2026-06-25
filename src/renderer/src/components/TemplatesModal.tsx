import { useState } from 'react'

interface Template {
  icon: string
  label: string
  taches: string[]
}

const TEMPLATES: Template[] = [
  {
    icon: '☀️',
    label: 'Routine Matin',
    taches: [
      'Écrire 3 intentions du jour',
      'Préparer ma liste de priorités',
      'Lire 10 minutes'
    ]
  },
  {
    icon: '🌙',
    label: 'Routine Soir',
    taches: [
      'Ranger mon espace de travail',
      'Écrire ma victoire du jour',
      'Préparer mes affaires pour demain'
    ]
  },
  {
    icon: '💼',
    label: 'Mode Travail',
    taches: [
      'Répondre aux emails urgents',
      'Vérifier mon agenda',
      'Avancer sur ma tâche principale'
    ]
  },
  {
    icon: '🏠',
    label: 'Mode Maison',
    taches: [
      'Faire une tâche ménagère',
      'Acheter ce qui manque',
      'Préparer les repas de demain'
    ]
  }
]

interface Props {
  onClose: () => void
  onSelectTemplate: (taches: string[]) => Promise<void>
}

export default function TemplatesModal({ onClose, onSelectTemplate }: Props): JSX.Element {
  const [loading, setLoading] = useState<string | null>(null)

  async function choisir(template: Template) {
    setLoading(template.label)
    await onSelectTemplate(template.taches)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🎲 Routine du jour</div>
          <button
            className="btn-ghost"
            style={{ fontSize: 20, padding: '2px 8px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              className="btn-ghost"
              style={{
                padding: '16px 14px',
                textAlign: 'left',
                borderRadius: 'var(--radius)',
                opacity: loading && loading !== t.label ? 0.5 : 1,
                cursor: loading ? 'wait' : 'pointer'
              }}
              disabled={!!loading}
              onClick={() => choisir(t)}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {t.taches.length} tâches
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
