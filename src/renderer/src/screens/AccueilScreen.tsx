import { useState, useEffect, useCallback } from 'react'
import type { TacheDTO, ProfilDTO, EnergieDTO, CompletionResult, NiveauEnergieJour } from '../../../shared/types'
import Celebration from '../components/Celebration'
import FocusScreen from './FocusScreen'
import TemplatesModal from '../components/TemplatesModal'
import RevueHebdoModal, { getISOWeek } from '../components/RevueHebdoModal'

const ENERGIE_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😴', label: 'À plat' },
  2: { emoji: '🥱', label: 'Fatigué' },
  3: { emoji: '😐', label: 'Moyen' },
  4: { emoji: '😊', label: 'Bien' },
  5: { emoji: '⚡', label: 'En feu' }
}

const ENERGIE_COULEUR: Record<string, string> = { micro: '#10b981', faible: '#a855f7', moyenne: '#f59e0b', haute: '#ef4444' }
const ENERGIE_LABEL: Record<string, string> = { micro: '⚡ Micro', faible: '🌱 Légère', moyenne: '🔥 Moyenne', haute: '💪 Haute' }

function salutation(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function AccueilScreen(): JSX.Element {
  const [profil, setProfil] = useState<ProfilDTO | null>(null)
  const [missions, setMissions] = useState<TacheDTO[]>([])
  const [energieJour, setEnergieJour] = useState<EnergieDTO | null>(null)
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)
  const [focusTache, setFocusTache] = useState<TacheDTO | null>(null)
  const [streakBonus, setStreakBonus] = useState(0)
  const [loading, setLoading] = useState(true)
  const [capture, setCapture] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showRevue, setShowRevue] = useState(false)
  const [revueFaite, setRevueFaite] = useState(false)

  const charger = useCallback(async () => {
    const [cx, m, e] = await Promise.all([
      window.api.connexionJournaliere(),
      window.api.getMissionsJour(),
      window.api.getEnergieJour()
    ])
    setProfil(cx.profil)
    if (cx.streakBonus > 0) setStreakBonus(cx.streakBonus)
    setMissions(m)
    setEnergieJour(e)
    setLoading(false)
  }, [])

  useEffect(() => { charger() }, [charger])

  useEffect(() => {
    const semaine = getISOWeek(new Date())
    window.api.getRevueHebdo(semaine).then((r) => setRevueFaite(!!r)).catch(console.error)
  }, [])

  async function setEnergie(n: NiveauEnergieJour) {
    const e = await window.api.setEnergieJour(n)
    setEnergieJour(e)
  }

  async function terminer(t: TacheDTO) {
    const res = await window.api.terminerTache(t.id)
    setCelebration(res)
    setProfil(res.profil)
    setMissions((prev) => prev.filter((m) => m.id !== t.id))
  }

  async function regenerer() {
    const m = await window.api.regenererMissions()
    setMissions(m)
  }

  async function appliquerTemplate(taches: string[]) {
    for (const titre of taches) {
      await window.api.createTache({ titre, niveauEnergie: 'faible' })
    }
    await regenerer()
  }

  async function ajouterCapture() {
    if (!capture.trim()) return
    await window.api.addCapture(capture.trim())
    setCapture('')
  }

  if (loading) {
    return (
      <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div style={{ textAlign: 'center', fontSize: 48 }}>🧠</div>
      </div>
    )
  }

  if (focusTache) {
    return (
      <FocusScreen
        tache={focusTache}
        onTerminer={async (duree) => {
          const res = await window.api.terminerTache(focusTache.id, duree)
          setCelebration(res)
          setProfil(res.profil)
          setMissions((prev) => prev.filter((m) => m.id !== focusTache.id))
          setFocusTache(null)
        }}
        onAbandonner={() => setFocusTache(null)}
      />
    )
  }

  return (
    <div className="screen">
      <Celebration result={celebration} onClose={() => setCelebration(null)} />

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>
          {salutation()}, {profil?.pseudo ?? 'Héros'} {profil?.avatarEmoji}
        </div>
        {streakBonus > 0 && (
          <div className="streak-badge" style={{ marginBottom: 8 }}>
            🔥 Streak bonus : +{streakBonus} 🪙 pour être revenu !
          </div>
        )}
        {profil && profil.streakJours > 1 && (
          <div className="streak-badge">🔥 {profil.streakJours} jours de suite</div>
        )}
      </div>

      {/* ── Énergie du moment ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>
          Comment tu te sens là, maintenant ?
        </div>
        <div className="energie-selector">
          {([1, 2, 3, 4, 5] as NiveauEnergieJour[]).map((n) => (
            <button
              key={n}
              className={`energie-btn${energieJour?.niveau === n ? ' active' : ''}`}
              onClick={() => setEnergie(n)}
              title={ENERGIE_LABELS[n].label}
            >
              {ENERGIE_LABELS[n].emoji}
            </button>
          ))}
        </div>
        {energieJour && (
          <div className="text-muted" style={{ marginTop: 8 }}>
            Énergie : <strong style={{ color: 'var(--text)' }}>{ENERGIE_LABELS[energieJour.niveau].label}</strong>
          </div>
        )}
      </div>

      {/* ── Missions du jour ── */}
      <div style={{ marginBottom: 20 }}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>⚔️ Tes 3 missions du jour</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={regenerer}>
              ↻ Changer
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: 13 }}
              onClick={() => setShowTemplates(true)}
            >
              🎲 Choisis pour moi
            </button>
          </div>
        </div>

        {missions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green)' }}>Toutes les missions sont terminées !</div>
            <div className="text-muted" style={{ marginTop: 4 }}>Incroyable. Ajoute des tâches pour demain.</div>
          </div>
        ) : (
          <div className="col">
            {missions.map((t) => (
              <div key={t.id} className={`mission-card${t.statut === 'en_cours' ? ' en-cours' : ''}`}>
                <div className="row-between">
                  <div>
                    <div className="mission-titre">{t.titre}</div>
                    {t.description && <div className="text-muted" style={{ marginTop: 3 }}>{t.description}</div>}
                  </div>
                  <button className="btn-icon" onClick={() => window.api.ignorerTache(t.id).then(() => setMissions((p) => p.filter((m) => m.id !== t.id)))}>✕</button>
                </div>
                <div className="mission-meta">
                  <span className={`badge badge-${t.niveauEnergie}`} style={{ background: ENERGIE_COULEUR[t.niveauEnergie] + '22', color: ENERGIE_COULEUR[t.niveauEnergie] }}>
                    {ENERGIE_LABEL[t.niveauEnergie]}
                  </span>
                  <span className="mission-duree">⏱ {t.dureeEstimeeMin} min</span>
                  <span className="badge badge-gold">+{t.xpRecompense} XP</span>
                  <span className="text-muted">+{t.coinsRecompense} 🪙</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn-launch" style={{ flex: 2 }} onClick={() => setFocusTache(t)}>
                    🚀 LANCER
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => terminer(t)}>
                    ✓ Déjà fait
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Capture rapide ── */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>💡 Capture rapide — vide ta tête</div>
        <div className="row">
          <input
            className="input"
            placeholder="Une idée, une tâche, un truc qui traîne dans ta tête..."
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ajouterCapture() }}
          />
          <button className="btn-primary" onClick={ajouterCapture} disabled={!capture.trim()}>
            ↵
          </button>
        </div>
        <div className="text-muted" style={{ marginTop: 6 }}>Appuie sur Entrée. On s'occupera de ça plus tard.</div>
      </div>

      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
          onSelectTemplate={appliquerTemplate}
        />
      )}

      {showRevue && (
        <RevueHebdoModal
          onClose={() => setShowRevue(false)}
          onSaved={() => setRevueFaite(true)}
        />
      )}

      <button
        className={revueFaite ? 'btn-ghost' : 'btn-launch'}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          borderRadius: 999,
          padding: '12px 20px',
          fontSize: 14,
          fontWeight: 700,
          zIndex: 50,
          background: revueFaite ? 'rgba(16,185,129,.15)' : undefined
        }}
        onClick={() => setShowRevue(true)}
      >
        {revueFaite ? '✅ Revue faite' : '📅 Revue de la semaine'}
      </button>
    </div>
  )
}
