import { useState, useEffect, useCallback } from 'react'
import type { TacheDTO, NiveauEnergie, TacheInput, CompletionResult } from '../../../shared/types'
import Celebration from '../components/Celebration'
import FocusScreen from './FocusScreen'
import TacheTitreInput from '../components/TacheTitreInput'

const NIVEAUX: { key: NiveauEnergie; label: string; desc: string; couleur: string }[] = [
  { key: 'micro', label: '⚡ Micro', desc: '< 5 min', couleur: '#10b981' },
  { key: 'faible', label: '✨ Légère', desc: '5-15 min', couleur: '#a855f7' },
  { key: 'moyenne', label: '🔥 Moyenne', desc: '15-45 min', couleur: '#f59e0b' },
  { key: 'haute', label: '💪 Haute', desc: '45+ min', couleur: '#ef4444' }
]

const DUREES: Record<NiveauEnergie, number> = { micro: 2, faible: 10, moyenne: 20, haute: 45 }

export default function QuestesScreen(): JSX.Element {
  const [taches, setTaches] = useState<TacheDTO[]>([])
  const [filtre, setFiltre] = useState<NiveauEnergie | 'toutes'>('toutes')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<TacheInput>({ titre: '', niveauEnergie: 'faible', dureeEstimeeMin: 10 })
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)
  const [focusTache, setFocusTache] = useState<TacheDTO | null>(null)

  const charger = useCallback(async () => {
    const t = await window.api.listTaches({ statut: 'active' })
    setTaches(t)
  }, [])

  useEffect(() => { charger() }, [charger])

  async function creer() {
    if (!form.titre.trim()) return
    await window.api.createTache({ ...form, titre: form.titre.trim(), pourquoi: form.pourquoi?.trim() || null })
    setForm({ titre: '', niveauEnergie: 'faible', dureeEstimeeMin: 10 })
    setShowForm(false)
    charger()
  }

  async function terminer(t: TacheDTO) {
    const res = await window.api.terminerTache(t.id)
    setCelebration(res)
    setTaches((prev) => prev.filter((x) => x.id !== t.id))
  }

  async function supprimer(id: number) {
    await window.api.deleteTache(id)
    setTaches((prev) => prev.filter((x) => x.id !== id))
  }

  async function togglePivot(t: TacheDTO) {
    await window.api.setPivot(t.id, !t.estPivot)
    await charger()
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

  const affichees = filtre === 'toutes' ? taches : taches.filter((t) => t.niveauEnergie === filtre)

  return (
    <div className="screen">
      <Celebration result={celebration} onClose={() => setCelebration(null)} />

      <div className="row-between" style={{ marginBottom: 20 }}>
        <div>
          <div className="screen-title">⚔️ Toutes tes quêtes</div>
          <div className="screen-subtitle">{taches.length} tâche{taches.length !== 1 ? 's' : ''} en attente</div>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? '✕ Annuler' : '+ Nouvelle quête'}
        </button>
      </div>

      {/* ── Formulaire ── */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Nouvelle quête</div>
          <div className="col">
            <TacheTitreInput
              value={form.titre}
              onChange={(v) => setForm((f) => ({ ...f, titre: v }))}
              placeholder="Titre de la tâche..."
              onKeyDown={(e) => { if (e.key === 'Enter') creer() }}
              autoFocus
            />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {NIVEAUX.map((n) => (
                <button
                  key={n.key}
                  onClick={() => setForm((f) => ({ ...f, niveauEnergie: n.key, dureeEstimeeMin: DUREES[n.key] }))}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius)',
                    border: `2px solid ${form.niveauEnergie === n.key ? n.couleur : 'var(--border)'}`,
                    background: form.niveauEnergie === n.key ? n.couleur + '22' : 'var(--bg-panel)',
                    color: form.niveauEnergie === n.key ? n.couleur : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13
                  }}
                >
                  {n.label} · {n.desc}
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>Durée estimée :</label>
              <input
                type="number"
                className="input"
                style={{ width: 80 }}
                min={1}
                max={120}
                value={form.dureeEstimeeMin}
                onChange={(e) => setForm((f) => ({ ...f, dureeEstimeeMin: +e.target.value }))}
              />
              <span className="text-muted">min</span>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: 13, display: 'block', marginBottom: 4 }}>
                💛 Pourquoi ça compte pour toi ? <span style={{ fontStyle: 'italic' }}>(optionnel)</span>
              </label>
              <textarea
                className="textarea"
                style={{ minHeight: 60 }}
                placeholder="Comment tu te sentiras une fois fait ? Pourquoi c'est important ?"
                value={form.pourquoi ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, pourquoi: e.target.value }))}
              />
            </div>
            <button className="btn-launch" onClick={creer} disabled={!form.titre.trim()}>
              ✚ Ajouter la quête
            </button>
          </div>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className={filtre === 'toutes' ? 'btn-primary' : 'btn-ghost'}
          style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => setFiltre('toutes')}
        >
          Toutes ({taches.length})
        </button>
        {NIVEAUX.map((n) => {
          const count = taches.filter((t) => t.niveauEnergie === n.key).length
          return (
            <button
              key={n.key}
              style={{
                padding: '5px 12px',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                fontWeight: 700,
                border: `2px solid ${filtre === n.key ? n.couleur : 'var(--border)'}`,
                background: filtre === n.key ? n.couleur + '22' : 'var(--bg-panel)',
                color: filtre === n.key ? n.couleur : 'var(--text-muted)',
                cursor: 'pointer'
              }}
              onClick={() => setFiltre(n.key)}
            >
              {n.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Liste ── */}
      {affichees.length === 0 ? (
        <div className="empty-state">
          {filtre === 'toutes' ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌟</div>
              <div>Aucune quête en attente — ajoutes-en une !</div>
            </>
          ) : (
            <div>Aucune quête dans cette catégorie.</div>
          )}
        </div>
      ) : (
        <div className="col">
          {affichees.map((t) => {
            const n = NIVEAUX.find((x) => x.key === t.niveauEnergie)!
            return (
              <div key={t.id} className="mission-card">
                <div className="row-between">
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                      {t.estPivot && <span className="tag" style={{ background: 'rgba(245,158,11,.18)', color: 'var(--gold)' }}>👑 Pivot</span>}
                      {t.estMissionJour && <span className="tag">Mission du jour</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, color: n.couleur }}>{n.label}</span>
                      <span className="text-muted">⏱ {t.dureeEstimeeMin} min</span>
                    </div>
                    <div className="mission-titre">{t.titre}</div>
                    {t.description && <div className="text-muted" style={{ marginTop: 3 }}>{t.description}</div>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn-icon"
                      title={t.estPivot ? 'Tâche pivot' : 'Définir comme tâche pivot'}
                      style={{ color: t.estPivot ? 'var(--gold)' : 'var(--text-muted)' }}
                      onClick={() => togglePivot(t)}
                    >
                      {t.estPivot ? '★' : '☆'}
                    </button>
                    <button className="btn-icon" onClick={() => supprimer(t.id)} title="Supprimer">🗑</button>
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-launch" style={{ flex: 2 }} onClick={() => setFocusTache(t)}>
                    🚀 LANCER
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => terminer(t)}>
                    ✓ Fait
                  </button>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="badge badge-gold">+{t.xpRecompense} XP</span>
                  <span className="text-muted">+{t.coinsRecompense} 🪙</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
