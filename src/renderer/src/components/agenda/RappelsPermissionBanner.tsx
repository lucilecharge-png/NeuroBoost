import { useState } from 'react'

// État de la permission de notification du navigateur.
type PermState = 'granted' | 'default' | 'denied' | 'unsupported'

function lirePermission(): PermState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as PermState
}

// Bannière affichée dans l'Agenda tant que les rappels ne peuvent pas s'afficher :
// les rappels reposent sur l'API Notification du navigateur, qui exige une permission
// accordée. Sans elle, les rappels échouent silencieusement. Une fois « granted »,
// la bannière disparaît.
export default function RappelsPermissionBanner(): JSX.Element | null {
  const [perm, setPerm] = useState<PermState>(lirePermission)

  if (perm === 'granted') return null

  async function activer(): Promise<void> {
    if (!('Notification' in window)) return
    // La demande de permission doit partir d'un geste utilisateur (ce clic).
    const res = await Notification.requestPermission()
    setPerm(res as PermState)
  }

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: '3px solid var(--gold)' }}>
      {perm === 'default' && (
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>
            🔔 Active les notifications pour recevoir tes rappels d'agenda.
            <span className="text-muted"> Ils s'affichent tant que NeuroBoost reste ouvert.</span>
          </span>
          <button className="btn-primary" onClick={activer}>Activer les rappels</button>
        </div>
      )}

      {perm === 'denied' && (
        <div style={{ fontSize: 13 }}>
          🔕 Les notifications sont <strong>bloquées</strong> — tes rappels ne s'afficheront pas.
          <div className="text-muted" style={{ marginTop: 4 }}>
            Pour les réactiver : clique sur l'icône 🔒 (ou ⓘ) à gauche de l'adresse → Notifications → Autoriser, puis recharge la page.
          </div>
        </div>
      )}

      {perm === 'unsupported' && (
        <div style={{ fontSize: 13 }}>
          ⚠️ Ton navigateur ne supporte pas les notifications — les rappels ne pourront pas s'afficher ici.
        </div>
      )}
    </div>
  )
}
