import { useState, useEffect, useCallback } from 'react'
import type { AchievementDTO, RecompenseDTO, ProfilDTO } from '../../../shared/types'

const ICONES = ['🎁', '🍕', '🎬', '📱', '☕', '🍦', '🎮', '🛁', '🎵', '🌿', '🏃', '💤']

export default function RecompensesScreen(): JSX.Element {
  const [profil, setProfil] = useState<ProfilDTO | null>(null)
  const [achievements, setAchievements] = useState<AchievementDTO[]>([])
  const [recompenses, setRecompenses] = useState<RecompenseDTO[]>([])
  const [onglet, setOnglet] = useState<'boutique' | 'badges'>('boutique')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ titre: '', coutCoins: 20, icone: '🎁' })
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const charger = useCallback(async () => {
    const [p, a, r] = await Promise.all([
      window.api.getProfil(),
      window.api.listAchievements(),
      window.api.listRecompenses()
    ])
    setProfil(p)
    setAchievements(a)
    setRecompenses(r)
  }, [])

  useEffect(() => { charger() }, [charger])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 2500)
  }

  async function acheter(r: RecompenseDTO) {
    if (!profil || profil.neurocoins < r.coutCoins) { flash('Pas assez de NeuroCoins 😔', false); return }
    const res = await window.api.acheterRecompense(r.id)
    setProfil(res.profil)
    setRecompenses((prev) => prev.map((x) => (x.id === r.id ? { ...x, utilisee: true } : x)))
    flash(`🎉 Profite bien de ta récompense !`)
  }

  async function creer() {
    if (!form.titre.trim()) return
    await window.api.createRecompense(form.titre.trim(), form.coutCoins, form.icone)
    setForm({ titre: '', coutCoins: 20, icone: '🎁' })
    setShowForm(false)
    charger()
  }

  async function supprimer(id: number) {
    await window.api.deleteRecompense(id)
    setRecompenses((prev) => prev.filter((r) => r.id !== id))
  }

  const nbDebloques = achievements.filter((a) => a.debloqueLe).length

  return (
    <div className="screen">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="screen-title">🏆 Récompenses</div>
        <div className="screen-subtitle">Célèbre tes victoires avec de vraies récompenses</div>
        {profil && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <div className="coins-badge" style={{ display: 'inline-flex' }}>
              🪙 {profil.neurocoins} NeuroCoins disponibles
            </div>
            <div className="streak-badge">⭐ Niveau {profil.niveau} · {profil.xp} / {profil.xpProchainNiveau} XP</div>
          </div>
        )}
      </div>

      {/* Message flash */}
      {msg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 'var(--radius)',
          background: msg.ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
          border: `1px solid ${msg.ok ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}`,
          color: msg.ok ? 'var(--green)' : 'var(--danger)',
          fontWeight: 700,
          marginBottom: 16
        }}>
          {msg.text}
        </div>
      )}

      {/* Onglets */}
      <div className="row" style={{ gap: 8, marginBottom: 20 }}>
        <button className={onglet === 'boutique' ? 'btn-primary' : 'btn-ghost'} onClick={() => setOnglet('boutique')}>
          🛒 Boutique
        </button>
        <button className={onglet === 'badges' ? 'btn-primary' : 'btn-ghost'} onClick={() => setOnglet('badges')}>
          🏅 Badges ({nbDebloques}/{achievements.length})
        </button>
      </div>

      {/* ── Boutique ── */}
      {onglet === 'boutique' && (
        <>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Tes récompenses</div>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowForm((s) => !s)}>
              {showForm ? '✕' : '+ Ajouter'}
            </button>
          </div>

          {showForm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="col">
                <input
                  className="input"
                  placeholder="Ex : 30 min de série sans culpabilité..."
                  value={form.titre}
                  onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                />
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <label className="text-muted">Coût :</label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 90 }}
                    min={1}
                    value={form.coutCoins}
                    onChange={(e) => setForm((f) => ({ ...f, coutCoins: +e.target.value }))}
                  />
                  <span className="text-muted">🪙</span>
                </div>
                <div>
                  <div className="text-muted" style={{ marginBottom: 6 }}>Icône :</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ICONES.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setForm((f) => ({ ...f, icone: ic }))}
                        style={{
                          width: 36,
                          height: 36,
                          fontSize: 20,
                          borderRadius: 8,
                          background: form.icone === ic ? 'var(--accent)' : 'var(--bg-panel)',
                          border: `2px solid ${form.icone === ic ? 'var(--accent-glow)' : 'var(--border)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <button className="btn-gold" onClick={creer} disabled={!form.titre.trim()}>
                  ✚ Créer la récompense
                </button>
              </div>
            </div>
          )}

          <div className="col">
            {recompenses.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: r.utilisee ? 'rgba(255,255,255,.04)' : 'var(--bg-card)',
                  border: `1px solid ${r.utilisee ? 'var(--border)' : 'rgba(245,158,11,.3)'}`,
                  borderRadius: 'var(--radius)',
                  opacity: r.utilisee ? .5 : 1
                }}
              >
                <span style={{ fontSize: 28 }}>{r.icone}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.titre}</div>
                  <div className="text-muted">{r.coutCoins} 🪙 NeuroCoins</div>
                </div>
                {r.utilisee ? (
                  <span className="text-muted" style={{ fontSize: 12 }}>Utilisée ✓</span>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn-gold"
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      onClick={() => acheter(r)}
                      disabled={!profil || profil.neurocoins < r.coutCoins}
                    >
                      Dépenser
                    </button>
                    <button className="btn-icon" onClick={() => supprimer(r.id)}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Badges ── */}
      {onglet === 'badges' && (
        <div className="col">
          {achievements.map((a) => (
            <div key={a.id} className={`achievement-card${a.debloqueLe ? ' unlocked' : ''}`}>
              <div className="achievement-icon">{a.icone}</div>
              <div className="achievement-info">
                <div className="achievement-titre">{a.titre}</div>
                <div className="achievement-desc">{a.description}</div>
                {a.debloqueLe ? (
                  <div className="text-green" style={{ fontSize: 11, marginTop: 2 }}>
                    ✓ Débloqué le {new Date(a.debloqueLe).toLocaleDateString('fr-FR')}
                  </div>
                ) : (
                  <div className="achievement-xp">+{a.xpBonus} XP à débloquer</div>
                )}
              </div>
              {!a.debloqueLe && <div style={{ fontSize: 22, opacity: .3 }}>🔒</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
