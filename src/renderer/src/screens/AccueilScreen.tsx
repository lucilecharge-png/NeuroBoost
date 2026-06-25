import { useState, useEffect, useCallback } from 'react'
import type { TacheDTO, ProfilDTO, EnergieDTO, CompletionResult, NiveauEnergieJour, ConsistanceDTO } from '../../../shared/types'
import Celebration from '../components/Celebration'
import FocusScreen from './FocusScreen'
import TemplatesModal from '../components/TemplatesModal'
import RevueHebdoModal, { getISOWeek } from '../components/RevueHebdoModal'
import ExcuseBusterModal from '../components/ExcuseBusterModal'

const ENERGIE_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😴', label: 'À plat' },
  2: { emoji: '🥱', label: 'Fatigué' },
  3: { emoji: '😐', label: 'Moyen' },
  4: { emoji: '😊', label: 'Bien' },
  5: { emoji: '⚡', label: 'En feu' }
}

const ENERGIE_COULEUR: Record<string, string> = { micro: '#10b981', faible: '#a855f7', moyenne: '#f59e0b', haute: '#ef4444' }
const ENERGIE_LABEL: Record<string, string> = { micro: '⚡ Micro', faible: '✨ Légère', moyenne: '🔥 Moyenne', haute: '💪 Haute' }

function salutation(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export default function AccueilScreen(): JSX.Element {
  const [profil, setProfil] = useState<ProfilDTO | null>(null)
  const [missions, setMissions] = useState<TacheDTO[]>([])
  const [pivot, setPivot] = useState<TacheDTO | null>(null)
  const [energieJour, setEnergieJour] = useState<EnergieDTO | null>(null)
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)
  const [focusTache, setFocusTache] = useState<TacheDTO | null>(null)
  const [streakBonus, setStreakBonus] = useState(0)
  const [loading, setLoading] = useState(true)
  const [capture, setCapture] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showRevue, setShowRevue] = useState(false)
  const [revueFaite, setRevueFaite] = useState(false)
  const [excuseTache, setExcuseTache] = useState<TacheDTO | null>(null)
  const [journeeSans, setJourneeSans] = useState(false)
  const [miniTache, setMiniTache] = useState<TacheDTO | null>(null)
  const [consistance, setConsistance] = useState<ConsistanceDTO | null>(null)
  const [prenomInput, setPrenomInput] = useState('')

  const charger = useCallback(async () => {
    const [cx, m, e, p, js, c] = await Promise.all([
      window.api.connexionJournaliere(),
      window.api.getMissionsJour(),
      window.api.getEnergieJour(),
      window.api.getTachePivot(),
      window.api.getJourneeSans(),
      window.api.getConsistance()
    ])
    setProfil(cx.profil)
    if (cx.streakBonus > 0) setStreakBonus(cx.streakBonus)
    setMissions(m)
    setEnergieJour(e)
    setPivot(p)
    setJourneeSans(js)
    setConsistance(c)
    setLoading(false)
  }, [])

  // Choisit la micro-tâche "strict minimum" pour le mode Journée Sans :
  // la plus petite tâche active disponible (énergie micro de préférence).
  const chargerMiniTache = useCallback(async () => {
    const micro = await window.api.listTaches({ statut: 'active', energie: 'micro' })
    if (micro.length > 0) { setMiniTache(micro[0]); return }
    const toutes = await window.api.listTaches({ statut: 'active' })
    setMiniTache(toutes[0] ?? null)
  }, [])

  async function activerJourneeSans(actif: boolean) {
    const js = await window.api.setJourneeSans(actif)
    setJourneeSans(js)
    if (js) await chargerMiniTache()
  }

  async function togglePivot(t: TacheDTO) {
    await window.api.setPivot(t.id, !t.estPivot)
    const [m, p] = await Promise.all([window.api.getMissionsJour(), window.api.getTachePivot()])
    setMissions(m)
    setPivot(p)
  }

  useEffect(() => { charger() }, [charger])

  useEffect(() => {
    const semaine = getISOWeek(new Date())
    window.api.getRevueHebdo(semaine).then((r) => setRevueFaite(!!r)).catch(console.error)
  }, [])

  useEffect(() => {
    if (journeeSans && !miniTache) chargerMiniTache()
  }, [journeeSans, miniTache, chargerMiniTache])

  async function setEnergie(n: NiveauEnergieJour) {
    const e = await window.api.setEnergieJour(n)
    setEnergieJour(e)
  }

  async function terminer(t: TacheDTO) {
    const res = await window.api.terminerTache(t.id)
    setCelebration(res)
    setProfil(res.profil)
    setMissions((prev) => prev.filter((m) => m.id !== t.id))
    if (t.estPivot) setPivot(null)
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

  async function enregistrerPrenom() {
    const prenom = prenomInput.trim()
    if (!prenom) return
    const p = await window.api.setPseudo(prenom)
    setProfil(p)
    setPrenomInput('')
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
          if (focusTache.estPivot) setPivot(null)
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
        {!profil || profil.pseudo === 'Héros' ? (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>
              {salutation()} 👋
            </div>
            <div className="text-muted" style={{ marginBottom: 10, fontSize: 14 }}>
              Comment tu t'appelles ? Je le retiendrai pour la prochaine fois.
            </div>
            <div className="row">
              <input
                className="input"
                placeholder="Ton prénom..."
                value={prenomInput}
                onChange={(e) => setPrenomInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') enregistrerPrenom() }}
                autoFocus
              />
              <button className="btn-primary" onClick={enregistrerPrenom} disabled={!prenomInput.trim()}>
                ↵
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>
            {salutation()}, {profil.pseudo}
          </div>
        )}
        {streakBonus > 0 && (
          <div className="streak-badge" style={{ marginBottom: 8 }}>
            🔥 Streak bonus : +{streakBonus} 🪙 pour être revenu !
          </div>
        )}
        {profil && profil.streakJours > 1 && (
          <div className="streak-badge">🔥 {profil.streakJours} jours de suite</div>
        )}

        {consistance && (
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}
            title={`${consistance.actifs30} jours actifs sur les 30 derniers`}
          >
            <div style={{ display: 'flex', gap: 5 }}>
              {consistance.jours7.map((actif, i) => (
                <div
                  key={i}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: actif ? 'var(--green)' : 'var(--border)',
                    boxShadow: actif ? '0 0 6px rgba(16,185,129,.5)' : 'none',
                    border: i === 6 ? '2px solid var(--accent)' : 'none',
                    boxSizing: 'border-box'
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text)' }}>{consistance.actifs7}/7</strong> jours actifs · la régularité bat l'intensité
            </div>
          </div>
        )}
      </div>

      {/* ── Tâche pivot (Boss Final) ── */}
      {pivot ? (
        <div
          className="card-glow"
          style={{
            marginBottom: 20,
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(245,158,11,.18), rgba(245,158,11,.04))',
            border: '2px solid var(--gold)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="row-between" style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--gold)', letterSpacing: .5, textTransform: 'uppercase' }}>
              👑 Ta tâche pivot
            </div>
            <button
              className="btn-icon"
              title="Retirer le statut pivot"
              onClick={() => togglePivot(pivot)}
            >
              ✕
            </button>
          </div>
          <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 4 }}>{pivot.titre}</div>
          {pivot.pourquoi ? (
            <div style={{ fontSize: 13, marginBottom: 14, fontStyle: 'italic', color: 'var(--gold)' }}>
              💛 « {pivot.pourquoi} »
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
              La SEULE chose qui change tout. Donne-lui au moins 15 minutes — le reste peut attendre.
            </div>
          )}
          <button className="btn-launch" style={{ width: '100%' }} onClick={() => setFocusTache(pivot)}>
            🚀 Attaquer le Boss Final
          </button>
        </div>
      ) : (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 16px',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
            fontSize: 13
          }}
        >
          👑 Aucune tâche pivot. Marque d'une étoile la SEULE chose qui changerait tout cette semaine.
        </div>
      )}

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

      {/* ── Mode Journée Sans (bare minimum) ── */}
      {journeeSans ? (
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(124,58,237,.12), rgba(14,165,233,.06))',
            border: '1px solid rgba(124,58,237,.3)'
          }}
        >
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>🌙 Mode Journée Sans</div>
            <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => activerJourneeSans(false)}>
              Revenir au mode normal
            </button>
          </div>
          <div className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Aujourd'hui, on ne casse pas la chaîne. Une seule chose suffit — le reste peut attendre, sans culpabilité.
          </div>
          {miniTache ? (
            <div className="mission-card">
              <div className="mission-titre" style={{ marginBottom: 8 }}>{miniTache.titre}</div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn-launch" style={{ flex: 2 }} onClick={() => setFocusTache(miniTache)}>
                  🚀 Juste ça
                </button>
                <button
                  className="btn-ghost"
                  style={{ flex: 1, fontSize: 13 }}
                  onClick={async () => { await terminer(miniTache); await chargerMiniTache() }}
                >
                  ✓ Fait
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Ton strict minimum aujourd'hui :</div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Fais 2 minutes sur une seule chose. N'importe laquelle. C'est tout ce qui compte aujourd'hui.
              </div>
            </div>
          )}
        </div>
      ) : (
      <>
      {energieJour && energieJour.niveau <= 2 && (
        <div
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'rgba(124,58,237,.08)',
            border: '1px solid rgba(124,58,237,.25)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ fontSize: 13 }}>
            🌙 Journée difficile ? Passe en <strong>mode minimum</strong> pour garder ta chaîne sans t'épuiser.
          </div>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={() => activerJourneeSans(true)}>
            Activer
          </button>
        </div>
      )}

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
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn-icon"
                      title={t.estPivot ? 'Tâche pivot' : 'Définir comme tâche pivot'}
                      style={{ color: t.estPivot ? 'var(--gold)' : 'var(--text-muted)' }}
                      onClick={() => togglePivot(t)}
                    >
                      {t.estPivot ? '★' : '☆'}
                    </button>
                    <button className="btn-icon" title="Reporter" onClick={() => setExcuseTache(t)}>✕</button>
                  </div>
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

      </>
      )}

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

      {excuseTache && (
        <ExcuseBusterModal
          tache={excuseTache}
          onSyMettre={() => { const t = excuseTache; setExcuseTache(null); setFocusTache(t) }}
          onReporter={async () => {
            const t = excuseTache
            setExcuseTache(null)
            await window.api.ignorerTache(t.id)
            setMissions((p) => p.filter((m) => m.id !== t.id))
          }}
          onClose={() => setExcuseTache(null)}
        />
      )}

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
