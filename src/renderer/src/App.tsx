import { useState, useEffect } from 'react'
import type { ProfilDTO } from '../../shared/types'
import AccueilScreen from './screens/AccueilScreen'
import QuestesScreen from './screens/QuestesScreen'
import RecompensesScreen from './screens/RecompensesScreen'
import CapturesScreen from './screens/CapturesScreen'
import CoachingScreen from './screens/CoachingScreen'
import TimerScreen from './screens/TimerScreen'
import TunnelScreen from './screens/TunnelScreen'
import RendezVousScreen from './screens/RendezVousScreen'
import RituelEcran from './components/RituelEcran'
import BackupModal from './components/BackupModal'
import { getRituelConfig, phaseActuelle, rituelFaitAujourdhui, marquerRituelFait, type Phase } from './data/rituels'

type Onglet = 'accueil' | 'quetes' | 'tunnel' | 'captures' | 'coaching' | 'timer' | 'rendezvous' | 'recompenses'

export default function App(): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('accueil')
  const [profil, setProfil] = useState<ProfilDTO | null>(null)
  const [rituel, setRituel] = useState<Phase | null>(null)
  const [backupOuvert, setBackupOuvert] = useState(false)

  useEffect(() => {
    window.api.getProfil().then(setProfil)
    // Mode Réveil/Coucher : propose le rituel hors-écran aux bonnes heures (1×/jour)
    const c = getRituelConfig()
    if (c.actif) {
      const p = phaseActuelle(c)
      if (p && !rituelFaitAujourdhui(p)) setRituel(p)
    }
  }, [])

  function ouvrirRituel(): void {
    const p = phaseActuelle(getRituelConfig()) ?? (new Date().getHours() < 14 ? 'reveil' : 'coucher')
    setRituel(p)
  }

  // Rafraîchit le profil de la sidebar après chaque changement d'onglet
  useEffect(() => {
    window.api.getProfil().then(setProfil)
  }, [onglet])

  function nav(id: Onglet, icon: string, label: string): JSX.Element {
    return (
      <button className={`nav-item${onglet === id ? ' active' : ''}`} onClick={() => setOnglet(id)}>
        <span className="nav-icon">{icon}</span>
        {label}
      </button>
    )
  }

  const xpPct = profil ? Math.round((profil.xp / profil.xpProchainNiveau) * 100) : 0

  return (
    <div className="app">
      {rituel && (
        <RituelEcran
          phase={rituel}
          onFermer={() => { marquerRituelFait(rituel); setRituel(null) }}
        />
      )}
      {backupOuvert && <BackupModal onFermer={() => setBackupOuvert(false)} />}

      {/* ── Sidebar ── */}
      <nav className="sidebar">
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/logo-mark.png"
            alt="NeuroBoost"
            style={{ height: 36, width: 36, borderRadius: 9, boxShadow: '0 2px 8px rgba(0,0,0,.35)' }}
          />
          <span>NeuroBoost</span>
        </div>

        {/* Profil */}
        {profil && (
          <>
            <div className="sidebar-profil" onClick={() => setOnglet('recompenses')}>
              <div className="sidebar-avatar">{profil.avatarEmoji}</div>
              <div className="sidebar-profil-info">
                <div className="sidebar-pseudo">{profil.pseudo}</div>
                <div className="sidebar-niveau">Niveau {profil.niveau}</div>
              </div>
            </div>
            <div className="xp-bar-wrap">
              <div className="xp-bar-bg">
                <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="xp-bar-label">{profil.xp} / {profil.xpProchainNiveau} XP</div>
            </div>
            <div className="coins-badge">
              🪙 {profil.neurocoins} NeuroCoins
            </div>
          </>
        )}

        {/* Navigation */}
        {nav('accueil', '⌂', 'Accueil')}
        {nav('quetes', '⚔️', 'Toutes mes quêtes')}
        {nav('tunnel', '🔭', 'Le Tunnel')}
        {nav('captures', '💡', 'Cerveau rapide')}

        {nav('coaching', '🧠', 'Coaching')}
        {nav('timer', '⏱', 'Timer')}
        {nav('rendezvous', '📌', 'Rendez-vous')}

        <div style={{ flex: 1 }} />
        <button className="nav-item" onClick={ouvrirRituel}>
          <span className="nav-icon">🌙</span>
          Rituel
        </button>
        <button className="nav-item" onClick={() => setBackupOuvert(true)}>
          <span className="nav-icon">💾</span>
          Sauvegarde
        </button>
        {nav('recompenses', '🏆', 'Récompenses')}
      </nav>

      {/* ── Contenu ── */}
      <main className="main-content">
        {onglet === 'accueil' && <AccueilScreen />}
        {onglet === 'quetes' && <QuestesScreen />}
        {onglet === 'tunnel' && <TunnelScreen />}
        {onglet === 'captures' && <CapturesScreen />}
        {onglet === 'coaching' && <CoachingScreen />}
        {onglet === 'timer' && <TimerScreen />}
        {onglet === 'rendezvous' && <RendezVousScreen />}
        {onglet === 'recompenses' && <RecompensesScreen />}
      </main>
    </div>
  )
}
