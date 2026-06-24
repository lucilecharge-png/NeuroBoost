import { useState, useEffect } from 'react'
import type { ProfilDTO } from '../../shared/types'
import AccueilScreen from './screens/AccueilScreen'
import QuestesScreen from './screens/QuestesScreen'
import RecompensesScreen from './screens/RecompensesScreen'
import CapturesScreen from './screens/CapturesScreen'
import CoachingScreen from './screens/CoachingScreen'
import TimerScreen from './screens/TimerScreen'

type Onglet = 'accueil' | 'quetes' | 'captures' | 'coaching' | 'timer' | 'recompenses'

export default function App(): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('accueil')
  const [profil, setProfil] = useState<ProfilDTO | null>(null)

  useEffect(() => {
    window.api.getProfil().then(setProfil)
  }, [])

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
      {/* ── Sidebar ── */}
      <nav className="sidebar">
        <div className="sidebar-logo">NeuroBoost</div>

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
        {nav('captures', '💡', 'Cerveau rapide')}

        {nav('coaching', '🧠', 'Coaching')}
        {nav('timer', '⏱', 'Timer')}

        <div style={{ flex: 1 }} />
        {nav('recompenses', '🏆', 'Récompenses')}
      </nav>

      {/* ── Contenu ── */}
      <main className="main-content">
        {onglet === 'accueil' && <AccueilScreen />}
        {onglet === 'quetes' && <QuestesScreen />}
        {onglet === 'captures' && <CapturesScreen />}
        {onglet === 'coaching' && <CoachingScreen />}
        {onglet === 'timer' && <TimerScreen />}
        {onglet === 'recompenses' && <RecompensesScreen />}
      </main>
    </div>
  )
}
