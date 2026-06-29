import { useState, useEffect, useCallback } from 'react'
import type { TacheDTO, CompletionResult } from '../../../shared/types'
import Celebration from '../components/Celebration'
import DecoupeQuete from '../components/DecoupeQuete'
import FocusScreen from './FocusScreen'

// « Le Tunnel » — vue ultra-minimaliste qui n'affiche que la tâche en cours
// (Maintenant) et la suivante (Juste après). Le reste est masqué pour
// éliminer la surcharge visuelle qui paralyse (méthode Maintenant/Après/Plus tard).
export default function TunnelScreen(): JSX.Element {
  const [taches, setTaches] = useState<TacheDTO[]>([])
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)
  const [focusTache, setFocusTache] = useState<TacheDTO | null>(null)
  const [voirReste, setVoirReste] = useState(false)
  // Carte « Maintenant » en cours d'animation de validation
  const [sortant, setSortant] = useState(false)

  // ── Découpe en mini-tâches ──
  const [decoupeOuvert, setDecoupeOuvert] = useState(false)

  const charger = useCallback(async () => {
    // Ordre déjà pertinent (mission/pivot d'abord, puis énergie croissante)
    const actives = await window.api.listTaches({ statut: 'active' })
    // La tâche pivot, si elle existe, passe en tête (« Maintenant »)
    actives.sort((a, b) => Number(b.estPivot) - Number(a.estPivot))
    setTaches(actives)
  }, [])

  useEffect(() => { charger() }, [charger])

  async function terminer(t: TacheDTO) {
    setSortant(true)
    const res = await window.api.terminerTache(t.id)
    setTimeout(() => {
      setCelebration(res)
      setTaches((prev) => prev.filter((x) => x.id !== t.id))
      setSortant(false)
    }, 480)
  }

  if (focusTache) {
    return (
      <FocusScreen
        tache={focusTache}
        onTerminer={async (duree) => {
          const res = await window.api.terminerTache(focusTache.id, duree)
          setCelebration(res)
          setTaches((prev) => prev.filter((x) => x.id !== focusTache.id))
          setFocusTache(null)
        }}
        onAbandonner={() => setFocusTache(null)}
      />
    )
  }

  const maintenant = taches[0] ?? null
  const apres = taches[1] ?? null
  const reste = taches.slice(2)

  return (
    <div className="screen" style={{ maxWidth: 600 }}>
      <Celebration result={celebration} onClose={() => setCelebration(null)} />

      <div className="screen-title">🔭 Le Tunnel</div>
      <div className="screen-subtitle">Une seule chose à la fois. Le reste attend, et c'est très bien.</div>

      {!maintenant ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌫️</div>
          <div>Le tunnel est vide. Ajoute des quêtes pour commencer.</div>
        </div>
      ) : (
        <div className="col" style={{ marginTop: 24, gap: 20 }}>
          {/* ── MAINTENANT ── */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent-glow)', marginBottom: 8 }}>
              👉 Maintenant
            </div>
            <div
              className="card-glow"
              style={{
                padding: '24px 22px',
                background: 'linear-gradient(135deg, rgba(124,58,237,.18), rgba(14,165,233,.06))',
                border: '2px solid var(--accent)',
                borderRadius: 'var(--radius-lg)',
                animation: sortant ? 'quete-done 480ms cubic-bezier(.4,0,.2,1) forwards' : undefined
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 6 }}>{maintenant.titre}</div>
              {maintenant.pourquoi && (
                <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--gold)', marginBottom: 14 }}>💛 « {maintenant.pourquoi} »</div>
              )}
              <div className="quete-actions" style={{ marginTop: 6 }}>
                <button className="btn-launch" onClick={() => setFocusTache(maintenant)}>
                  🚀 LANCER
                </button>
                <button className="btn-ghost" onClick={() => terminer(maintenant)}>
                  ✓ Fait
                </button>
                <button className="btn-ghost" onClick={() => setDecoupeOuvert((o) => !o)}>
                  ✂️ Découper
                </button>
              </div>
              {decoupeOuvert && (
                <DecoupeQuete
                  tache={maintenant}
                  onTermine={() => { setDecoupeOuvert(false); charger() }}
                  onAnnuler={() => setDecoupeOuvert(false)}
                />
              )}
            </div>
          </div>

          {/* ── JUSTE APRÈS ── */}
          {apres && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                ⏭ Juste après
              </div>
              <div style={{ padding: '16px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', opacity: 0.85 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{apres.titre}</div>
              </div>
            </div>
          )}

          {/* ── PLUS TARD (masqué) ── */}
          {reste.length > 0 && (
            <div>
              <button
                className="btn-ghost"
                style={{ fontSize: 12, color: 'var(--text-muted)' }}
                onClick={() => setVoirReste((v) => !v)}
              >
                {voirReste ? '▲ Masquer' : `▼ Plus tard (${reste.length})`}
              </button>
              {voirReste && (
                <div className="col" style={{ gap: 6, marginTop: 8 }}>
                  {reste.map((t) => (
                    <div key={t.id} style={{ padding: '10px 14px', background: 'var(--bg-panel)', borderRadius: 'var(--radius)', fontSize: 13, color: 'var(--text-muted)' }}>
                      {t.titre}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
