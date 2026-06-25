import { useState, useEffect, useCallback } from 'react'
import type { RendezVousDTO } from '../../../shared/types'

// Valeur 'YYYY-MM-DDTHH:MM' (heure locale) pour un <input type="datetime-local">
function pourInput(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function formatMoment(moment: string): string {
  const d = new Date(moment.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return moment
  return d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function RendezVousScreen(): JSX.Element {
  const [rdvs, setRdvs] = useState<RendezVousDTO[]>([])
  const [titre, setTitre] = useState('')
  const [moment, setMoment] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0)
    return pourInput(d)
  })

  const charger = useCallback(async () => {
    setRdvs(await window.api.listRendezVous())
  }, [])

  useEffect(() => { charger() }, [charger])

  async function creer() {
    if (!titre.trim() || !moment) return
    const rv = await window.api.createRendezVous(titre.trim(), moment.replace('T', ' '))
    setRdvs((p) => [...p, rv].sort((a, b) => a.moment.localeCompare(b.moment)))
    setTitre('')
  }

  async function annuler(id: number) {
    await window.api.cancelRendezVous(id)
    setRdvs((p) => p.filter((r) => r.id !== id))
  }

  const maintenant = pourInput(new Date()).replace('T', ' ')
  const aVenir = rdvs.filter((r) => r.moment >= maintenant && !r.notifie)
  const passes = rdvs.filter((r) => r.moment < maintenant || r.notifie)

  return (
    <div className="screen" style={{ maxWidth: 600 }}>
      <div className="screen-title">📌 Rendez-vous Fantômes</div>
      <div className="screen-subtitle">Prends rendez-vous avec toi-même. NeuroBoost te le rappellera comme un vrai engagement.</div>

      {/* ── Création ── */}
      <div className="card card-glow" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Bloquer un créneau pour toi</div>
        <input
          className="input"
          placeholder="Ex : Rédaction — chapitre 2, Sport, Démarches admin…"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') creer() }}
          style={{ marginBottom: 10 }}
        />
        <div className="row" style={{ gap: 10 }}>
          <input
            type="datetime-local"
            className="input"
            value={moment}
            min={pourInput(new Date())}
            onChange={(e) => setMoment(e.target.value)}
          />
          <button className="btn-launch" onClick={creer} disabled={!titre.trim() || !moment}>
            📌 Sceller
          </button>
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          À l'heure dite, une notification te rappellera : « Rendez-vous avec toi-même ». Sacralise ce temps.
        </div>
      </div>

      {/* ── À venir ── */}
      <div className="col" style={{ marginTop: 20 }}>
        {aVenir.length === 0 ? (
          <div className="empty-state">Aucun rendez-vous à venir.<br />Le temps que tu ne bloques pas pour toi, les autres le prendront.</div>
        ) : (
          aVenir.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid rgba(124,58,237,.3)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: 22 }}>📌</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{r.titre}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{formatMoment(r.moment)}</div>
              </div>
              <button className="btn-icon" onClick={() => annuler(r.id)} title="Annuler">✕</button>
            </div>
          ))
        )}
      </div>

      {/* ── Passés ── */}
      {passes.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="section-header" style={{ marginBottom: 8 }}>Passés</div>
          <div className="col">
            {passes.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 'var(--radius)', opacity: 0.6 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{r.titre}</span>
                  <span className="text-muted"> · {formatMoment(r.moment)}</span>
                </div>
                <button className="btn-icon" style={{ width: 24, height: 24, fontSize: 11 }} onClick={() => annuler(r.id)}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
