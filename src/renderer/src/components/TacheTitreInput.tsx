import { useState } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

const VERBES = new Set([
  'rédiger', 'envoyer', 'appeler', 'créer', 'lire', 'écrire', 'préparer',
  'organiser', 'planifier', 'finir', 'terminer', 'relire', 'contacter',
  'vérifier', 'chercher', 'faire', 'classer', 'acheter', 'réserver',
  'nettoyer', 'trier', 'installer', 'configurer', 'démarrer', 'publier',
  'commencer', 'réviser', 'corriger', 'soumettre', 'analyser'
])

function demandeVerbe(titre: string): boolean {
  if (!titre.trim()) return false
  const premierMot = titre.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  return !VERBES.has(premierMot) && !VERBES.has(titre.trim().split(/\s+/)[0].toLowerCase())
}

function genererSuggestions(titre: string): string[] {
  const t = titre.trim()
  const tl = t.toLowerCase()
  if (tl.includes('email') || tl.includes('mail') || tl.includes('message')) {
    return [`Répondre aux emails`, `Envoyer un email — ${t}`, `Rédiger ${t}`]
  }
  if (tl.includes('rapport') || tl.includes('document')) {
    return [`Rédiger ${t}`, `Finaliser ${t}`, `Relire ${t}`]
  }
  if (tl.includes('réunion') || tl.includes('meeting') || tl.includes('appel') || tl.includes('call')) {
    return [`Préparer la réunion — ${t}`, `Appeler pour ${t}`, `Organiser ${t}`]
  }
  if (tl.includes('code') || tl.includes('bug') || tl.includes('feature') || tl.includes('dev')) {
    return [`Corriger ${t}`, `Implémenter ${t}`, `Tester ${t}`]
  }
  if (tl.includes('courses') || tl.includes('achat') || tl.includes('commande')) {
    return [`Acheter ${t}`, `Commander ${t}`, `Préparer ${t}`]
  }
  if (tl.includes('projet') || tl.includes('plan') || tl.includes('tâche')) {
    return [`Avancer sur ${t}`, `Planifier ${t}`, `Organiser ${t}`]
  }
  return [`Faire ${t}`, `Terminer ${t}`, `Commencer ${t}`]
}

export default function TacheTitreInput({ value, onChange, placeholder }: Props): JSX.Element {
  const [ignored, setIgnored] = useState(false)

  const afficherSuggestions = !ignored && demandeVerbe(value) && value.trim().length > 3

  return (
    <div style={{ width: '100%' }}>
      <input
        className="input"
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setIgnored(false) }}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
      {afficherSuggestions && (
        <div style={{ marginTop: 6, padding: '10px 12px', background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.25)', borderRadius: 'var(--radius)', fontSize: 13 }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: 12 }}>
            💡 Ajoute un verbe pour clarifier l'action :
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {genererSuggestions(value).map((s) => (
              <button
                key={s}
                type="button"
                className="btn-ghost"
                style={{ textAlign: 'left', fontSize: 13, padding: '4px 8px' }}
                onClick={() => { onChange(s); setIgnored(true) }}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setIgnored(true)}
          >
            Ignorer
          </button>
        </div>
      )}
    </div>
  )
}
